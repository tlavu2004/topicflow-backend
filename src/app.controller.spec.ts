import { AppController } from './app.controller';

describe('AppController', () => {
  it('returns health status', () => {
    expect(new AppController().getHealth()).toEqual({ status: 'ok' });
  });
});
