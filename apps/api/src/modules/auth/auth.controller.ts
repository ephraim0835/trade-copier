import { Controller, Post, UseGuards, Request, Body, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Request() req: any) {
    return this.authService.login(req.user);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() body: any) {
    if (!body.email || !body.password) {
      throw new ConflictException('Email and password are required');
    }
    return this.authService.register(body.email, body.password, body.name);
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('refresh')
  async refresh(@Body() body: any) {
    if (!body?.refresh_token) {
      throw new UnauthorizedException('refresh_token is required');
    }
    return this.authService.refreshToken(body.refresh_token);
  }
}

