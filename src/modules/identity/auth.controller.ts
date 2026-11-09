import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccessTokenGuard, bearerToken } from './access-token.guard';
import type { AuthenticatedRequest } from './access-token.guard';
import { CredentialsDto, TokenPairDto, UserDto } from './auth.dto';
import { AuthService } from './auth.service';
import { LoginLimitGuard } from './login-limit.guard';

@ApiTags('Identity')
@ApiUnauthorizedResponse({
  description:
    'Missing, invalid, expired or revoked credentials; Problem Details',
})
@ApiResponse({ status: 400, description: 'Invalid request; Problem Details' })
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('auth/register')
  @UseGuards(LoginLimitGuard)
  @ApiCreatedResponse({ type: UserDto })
  @ApiConflictResponse({ description: 'Email already registered' })
  @ApiResponse({
    status: 429,
    description: 'Authentication attempt limit reached',
  })
  register(@Body() dto: CredentialsDto) {
    return this.auth.register(dto);
  }

  @Post('auth/login')
  @HttpCode(200)
  @UseGuards(LoginLimitGuard)
  @ApiOkResponse({ type: TokenPairDto })
  @ApiResponse({
    status: 429,
    description: 'Authentication attempt limit reached',
  })
  login(
    @Body() dto: CredentialsDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.auth.login(dto);
  }

  @Post('auth/refresh')
  @HttpCode(200)
  @ApiBearerAuth('refresh-token')
  @ApiOkResponse({ type: TokenPairDto })
  refresh(
    @Headers('authorization') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.auth.refresh(bearerToken(header));
  }

  @Post('auth/logout')
  @HttpCode(204)
  @ApiBearerAuth('refresh-token')
  @ApiNoContentResponse()
  logout(@Headers('authorization') header: string | undefined) {
    return this.auth.logout(bearerToken(header));
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserDto })
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.me(request.userId);
  }
}
