import path from 'node:path';
import ts from 'typescript';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const config = ts.readConfigFile(
  path.join(projectRoot, 'tsconfig.json'),
  ts.sys.readFile,
);
const { options } = ts.parseJsonConfigFileContent(
  config.config,
  ts.sys,
  projectRoot,
);
const normalize = (value) => value.replaceAll('\\', '/');
const sourceRoot = normalize(path.join(projectRoot, 'src')) + '/';

export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      privateModule:
        'Import another domain only through its public src/modules/<name>/index.ts entry point.',
      infrastructure:
        'Shared infrastructure must not depend on a domain module.',
      database:
        'Only module repositories and module composition may import database infrastructure.',
      computed: 'Use literal import paths so module boundaries can be checked.',
    },
  },
  create(context) {
    const filename = normalize(path.resolve(context.filename));
    const source = filename.slice(sourceRoot.length);
    const ownModule = /^modules\/([^/]+)\//.exec(source)?.[1];
    const infrastructure = /^(common|config|database)\//.test(source);
    const persistenceAllowed = /\.(repository|module)\.ts$/.test(source);

    function check(node, value) {
      if (typeof value !== 'string') {
        context.report({ node, messageId: 'computed' });
        return;
      }
      const resolved = ts.resolveModuleName(value, filename, options, ts.sys)
        .resolvedModule?.resolvedFileName;
      const fallback = value.startsWith('.')
        ? path.resolve(path.dirname(filename), value)
        : path.resolve(projectRoot, value);
      const target = normalize(resolved ?? fallback);
      const localTarget = target.startsWith(sourceRoot)
        ? target.slice(sourceRoot.length)
        : '';
      const targetModule = /^modules\/([^/]+)(?:\/|$)/.exec(localTarget)?.[1];
      if (targetModule && infrastructure) {
        context.report({ node, messageId: 'infrastructure' });
      } else if (
        targetModule &&
        targetModule !== ownModule &&
        !new RegExp(
          `^modules/${targetModule}(?:/index(?:\\.[cm]?[jt]s)?)?$`,
        ).test(localTarget)
      ) {
        context.report({ node, messageId: 'privateModule' });
      }
      const database =
        /^(database|generated\/prisma)(?:\/|$)/.test(localTarget) ||
        /^(?:@prisma\/client|@prisma\/adapter-pg|pg)(?:\/|$)/.test(value);
      if (ownModule && database && !persistenceAllowed) {
        context.report({ node, messageId: 'database' });
      }
    }

    return {
      ImportDeclaration: (node) => check(node, node.source.value),
      ExportNamedDeclaration: (node) => {
        if (node.source) check(node, node.source.value);
      },
      ExportAllDeclaration: (node) => check(node, node.source.value),
      ImportExpression: (node) => check(node, node.source.value),
      CallExpression: (node) => {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require'
        ) {
          check(node, node.arguments[0]?.value);
        }
      },
      TSExternalModuleReference: (node) => check(node, node.expression.value),
    };
  },
};
