import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import path from 'node:path';
import rule from './module-boundaries.mjs';

const at = (file) => path.resolve('src', file);
const consumer = at('modules/topic/topic.service.ts');
const error = (messageId) => [{ messageId }];
const tester = new RuleTester({ languageOptions: { parser: tseslint.parser } });

tester.run('module-boundaries', rule, {
  valid: [
    {
      filename: consumer,
      code: "import { IdentityModule } from '../identity';",
    },
    {
      filename: consumer,
      code: "import type { IdentityPrincipal } from 'src/modules/identity/index';",
    },
    {
      filename: at('app.module.ts'),
      code: "export { IdentityModule } from './modules/identity';",
    },
    {
      filename: at('modules/identity/auth.service.ts'),
      code: "import { IdentityRepository } from './identity.repository';",
    },
    {
      filename: at('modules/identity/identity.repository.ts'),
      code: "import { PrismaService } from '../../database/prisma.service';",
    },
    {
      filename: at('database/prisma.service.ts'),
      code: "import { PrismaClient } from '../generated/prisma/client';",
    },
  ],
  invalid: [
    {
      filename: consumer,
      code: "import { AuthService } from '../identity/auth.service';",
      errors: error('privateModule'),
    },
    {
      filename: consumer,
      code: "import type { CredentialsDto } from 'src/modules/identity/auth.dto';",
      errors: error('privateModule'),
    },
    {
      filename: consumer,
      code: "export * from '../identity/identity.repository';",
      errors: error('privateModule'),
    },
    {
      filename: consumer,
      code: "const auth = import('../identity/auth.service');",
      errors: error('privateModule'),
    },
    {
      filename: consumer,
      code: "const auth = require('../identity/auth.service');",
      errors: error('privateModule'),
    },
    {
      filename: consumer,
      code: "import auth = require('../identity/auth.service');",
      errors: error('privateModule'),
    },
    {
      filename: consumer,
      code: 'const auth = import(variable);',
      errors: error('computed'),
    },
    {
      filename: at('common/identity.ts'),
      code: "import { IdentityModule } from '../modules/identity';",
      errors: error('infrastructure'),
    },
    {
      filename: consumer,
      code: "import { PrismaService } from '../../database/prisma.service';",
      errors: error('database'),
    },
    {
      filename: at('modules/identity/access-token.guard.ts'),
      code: "import { PrismaClient } from '../../generated/prisma/client';",
      errors: error('database'),
    },
    {
      filename: consumer,
      code: "import { PrismaClient } from '@prisma/client';",
      errors: error('database'),
    },
  ],
});
