import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import nodemailer from "nodemailer";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ path: ".env.local" });

const app = express();
const port = Number(process.env.PORT ?? process.env.MAIL_SERVER_PORT ?? 3001);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticDir = path.join(projectRoot, "dist");

const origenesPermitidos = [
  "http://localhost:5173",
  process.env.FRONTEND_ORIGIN,
].filter(Boolean);

app.use(
  cors({
    origin(origen, callback) {
      if (!origen || origenesPermitidos.includes(origen)) {
        return callback(null, true);
      }

      return callback(new Error("Origen no permitido"));
    },
  }),
);
app.use(express.json({ limit: "32kb" }));

function escaparHtml(valor) {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nombreServicio(valor) {
  const servicios = {
    civil: "Ingeniería Civil",
    vias: "Vías y Pavimentos",
    topografia: "Topografía de Precisión",
    construccion: "Construcción y Edificación",
  };

  return servicios[valor] ?? valor;
}

app.post("/api/contact", async (req, res) => {
  const { nombre, correo, telefono, tipoObra, ubicacion, honeypot } = req.body ?? {};

  if (honeypot) {
    return res.status(200).json({ ok: true });
  }

  if (
    typeof nombre !== "string" ||
    typeof correo !== "string" ||
    typeof telefono !== "string" ||
    typeof tipoObra !== "string" ||
    typeof ubicacion !== "string" ||
    !nombre.trim() ||
    !correo.trim() ||
    !telefono.trim() ||
    !tipoObra.trim() ||
    !ubicacion.trim()
  ) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  const correoContacto = correo.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoContacto)) {
    return res.status(400).json({ error: "El correo electrónico no es válido" });
  }

  const usuario = process.env.EMAIL_USER;
  const contrasenaAplicacion = process.env.GOOGLE_APP_PASSWORD;

  if (!usuario || !contrasenaAplicacion) {
    console.error("EMAIL_USER o GOOGLE_APP_PASSWORD no están configuradas.");
    return res.status(503).json({ error: "El servicio de correo no está configurado" });
  }

  try {
    const logoPath = path.resolve(process.cwd(), "src", "assets", "logo-white.png");
    const transporte = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: usuario,
        pass: contrasenaAplicacion,
      },
    });

    await transporte.sendMail({
      from: `INGEVIT Web <${usuario}>`,
      to: "ejmora@jdc.edu.co",
      replyTo: correoContacto,
      subject: `Nueva solicitud de estudio - ${nombre.trim()}`,
      html: `
        <div style="margin:0;padding:32px 16px;background:#f4f5f2;font-family:Arial,Helvetica,sans-serif;color:#0b192b;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;margin:0 auto;border-collapse:collapse;">
            <tr>
              <td style="padding:28px 34px;background:#071525;border-bottom:4px solid #f45d22;">
                <img src="cid:ingevit-logo" alt="INGEVIT" width="148" style="display:block;width:148px;height:auto;border:0;" />
                <p style="margin:20px 0 0;color:#e6e9ed;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Gestión de proyectos</p>
              </td>
            </tr>
            <tr>
              <td style="padding:34px;background:#ffffff;">
                <p style="margin:0 0 8px;color:#f45d22;font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">Nueva solicitud</p>
                <h1 style="margin:0;color:#0b192b;font-size:27px;line-height:1.25;font-weight:700;">Una persona quiere conocer INGEVIT</h1>
                <p style="margin:14px 0 28px;color:#596575;font-size:15px;line-height:1.6;">Estos son los datos enviados desde el formulario web.</p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e3e6e8;border-collapse:separate;border-spacing:0;">
                  <tr>
                    <td style="width:34%;padding:15px 18px;background:#f8f9f7;border-bottom:1px solid #e3e6e8;color:#596575;font-size:13px;font-weight:700;">Nombre</td>
                    <td style="padding:15px 18px;border-bottom:1px solid #e3e6e8;color:#0b192b;font-size:15px;">${escaparHtml(nombre.trim())}</td>
                  </tr>
                  <tr>
                    <td style="width:34%;padding:15px 18px;background:#f8f9f7;border-bottom:1px solid #e3e6e8;color:#596575;font-size:13px;font-weight:700;">Correo</td>
                    <td style="padding:15px 18px;border-bottom:1px solid #e3e6e8;font-size:15px;"><a href="mailto:${correoContacto}" style="color:#e6531d;text-decoration:none;">${escaparHtml(correoContacto)}</a></td>
                  </tr>
                  <tr>
                    <td style="width:34%;padding:15px 18px;background:#f8f9f7;border-bottom:1px solid #e3e6e8;color:#596575;font-size:13px;font-weight:700;">Teléfono</td>
                    <td style="padding:15px 18px;border-bottom:1px solid #e3e6e8;color:#0b192b;font-size:15px;">${escaparHtml(telefono.trim())}</td>
                  </tr>
                  <tr>
                    <td style="width:34%;padding:15px 18px;background:#f8f9f7;border-bottom:1px solid #e3e6e8;color:#596575;font-size:13px;font-weight:700;">Servicio</td>
                    <td style="padding:15px 18px;border-bottom:1px solid #e3e6e8;color:#0b192b;font-size:15px;">${escaparHtml(nombreServicio(tipoObra.trim()))}</td>
                  </tr>
                  <tr>
                    <td style="width:34%;padding:15px 18px;background:#f8f9f7;color:#596575;font-size:13px;font-weight:700;">Ubicación</td>
                    <td style="padding:15px 18px;color:#0b192b;font-size:15px;">${escaparHtml(ubicacion.trim())}</td>
                  </tr>
                </table>

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;">
                  <tr>
                    <td style="background:#f45d22;">
                      <a href="mailto:${correoContacto}?subject=${encodeURIComponent("Respuesta a tu solicitud de INGEVIT")}" style="display:inline-block;padding:14px 20px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Responder al contacto</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 34px;background:#0b192b;color:#b7c0ca;font-size:12px;line-height:1.5;">Este mensaje fue generado automáticamente desde el formulario de contacto de INGEVIT.</td>
            </tr>
          </table>
        </div>
      `,
      attachments: [
        {
          filename: "ingevit-logo.png",
          path: logoPath,
          cid: "ingevit-logo",
        },
      ],
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Error enviando correo con Gmail:", error);
    return res.status(500).json({ error: "No se pudo enviar el correo" });
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(staticDir));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Servidor de correo disponible en http://localhost:${port}`);
});
