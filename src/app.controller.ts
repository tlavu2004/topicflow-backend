import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Ops')
@Controller()
export class AppController {
  @Get('health')
  @ApiOkResponse({ description: 'Process is running' })
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
