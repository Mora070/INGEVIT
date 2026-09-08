import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class AppController {
  @Get()
  getHealth(): { status: string; message: string } {
    return {
      status: 'ok',
      message: 'El backend de INGEVIT está funcionando',
    };
  }
}