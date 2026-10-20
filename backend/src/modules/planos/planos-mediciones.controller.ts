import { Body, Controller, Get, Header, Param, ParseIntPipe, ParseUUIDPipe, Put, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthRequest } from '../auth/types/auth-request.types';
import { GuardarMedicionesDto } from './dto/guardar-mediciones.dto';
import { PlanosMedicionesService } from './planos-mediciones.service';

@Controller('proyectos/:idProyecto/planos/:idPlano/paginas/:pagina/mediciones')
@UseGuards(AuthGuard)
export class PlanosMedicionesController {
  constructor(private readonly mediciones: PlanosMedicionesService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  consultar(@Param('idProyecto', new ParseUUIDPipe()) proyecto: string,
    @Param('idPlano', new ParseUUIDPipe()) plano: string,
    @Param('pagina', ParseIntPipe) pagina: number, @Req() request: AuthRequest) {
    if (!request.usuario) throw new UnauthorizedException();
    return this.mediciones.consultar(proyecto, plano, pagina, request.usuario.id_usuario);
  }

  @Put()
  @Header('Cache-Control', 'no-store')
  guardar(@Param('idProyecto', new ParseUUIDPipe()) proyecto: string,
    @Param('idPlano', new ParseUUIDPipe()) plano: string,
    @Param('pagina', ParseIntPipe) pagina: number, @Req() request: AuthRequest,
    @Body() dto: GuardarMedicionesDto) {
    if (!request.usuario) throw new UnauthorizedException();
    return this.mediciones.guardar(proyecto, plano, pagina, request.usuario.id_usuario, dto);
  }
}
