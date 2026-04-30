// server.js
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config(); // Carga las variables de entorno desde .env

const app = express();
app.use(cors());
app.use(express.json());

// ─── Conexión MongoDB ────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGODB_URI_INTRANET;

if (!MONGO_URI) {
  console.error("❌ MONGODB_URI no está definida en las variables de entorno.");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => console.log("✅ Conexión exitosa a MongoDB Atlas"))
  .catch((err) => {
    console.error("❌ Error de conexión a MongoDB:", err.message);
    process.exit(1); // Detiene el servidor si no hay BD
  });

// ─── Transporter de correo (SMTP corporativo @bancodealimentos.co) ────────────
// Configura estas variables en Render → Environment Variables:
//
//   SMTP_HOST     → servidor SMTP de tu proveedor (ej: mail.bancodealimentos.co)
//   SMTP_PORT     → generalmente 465 (SSL) o 587 (TLS)
//   SMTP_SECURE   → "true" para puerto 465, "false" para 587
//   SMTP_USER     → correo remitente (ej: notificaciones@bancodealimentos.co)
//   SMTP_PASS     → contraseña del correo corporativo
//   MAIL_TO       → destino fijo (ej: administrativa@bancodealimentos.co)

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: process.env.SMTP_SECURE === "true", // true = SSL/465, false = TLS/587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verifica la conexión SMTP al arrancar el servidor
transporter.verify((error) => {
  if (error) {
    console.error("❌ Error al conectar con el servidor SMTP:", error.message);
  } else {
    console.log("✅ Servidor SMTP listo para enviar correos");
  }
});

// ─── Esquema: Tickets de Soporte Técnico ────────────────────────────────────
const ticketSoporteSchema = new mongoose.Schema({
  numero_ticket: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  nombres: {
    type: String,
    required: true,
  },
  apellidos: {
    type: String,
    required: true,
  },
  area: {
    type: String,
    required: true,
  },
  cargo: {
    type: String,
    required: true,
  },
  tipo_novedad: {
    type: String,
    required: true,
  },
  descripcion_falla: {
    type: String,
    required: true,
  },
  estado: {
    type: String,
    default: 'Abierto',
    enum: ['Abierto', 'En Progreso', 'Cerrado'],
  },
  fecha_creacion: {
    type: Date,
    default: Date.now,
  },
  fecha_actualizacion: {
    type: Date,
    default: Date.now,
  },
})

const TicketSoporte = mongoose.model('TicketSoporte', ticketSoporteSchema)

// ─── Ruta: Guardar Ticket de Soporte Técnico ────────────────────────────────
app.post("/api/tickets-soporte", async (req, res) => {
  try {
    const { numero_ticket, nombres, apellidos, area, cargo, tipo_novedad, descripcion_falla } = req.body

    if (!numero_ticket || !nombres || !apellidos || !area || !cargo || !tipo_novedad || !descripcion_falla) {
      return res.status(400).json({ error: "Todos los campos son obligatorios." })
    }

    const nuevoTicket = new TicketSoporte({
      numero_ticket,
      nombres,
      apellidos,
      area,
      cargo,
      tipo_novedad,
      descripcion_falla,
    })

    await nuevoTicket.save()

    console.log(`✅ Ticket ${numero_ticket} guardado en MongoDB`)
    res.json({
      ok: true,
      message: "Ticket guardado correctamente.",
      ticket: nuevoTicket,
    })
  } catch (error) {
    console.error("❌ Error al guardar ticket:", error.message)
    res.status(500).json({ error: "No se pudo guardar el ticket." })
  }
})

// ─── Ruta: Obtener todos los tickets (opcional) ───────────────────────────────
app.get("/api/tickets-soporte", async (req, res) => {
  try {
    const tickets = await TicketSoporte.find().sort({ fecha_creacion: -1 })
    res.json({ ok: true, tickets })
  } catch (error) {
    console.error("❌ Error al obtener tickets:", error.message)
    res.status(500).json({ error: "No se pudieron obtener los tickets." })
  }
})

// ─── Ruta: Envío de formulario ───────────────────────────────────────────────
app.post("/send-email", async (req, res) => {
  const { nombre, email, mensaje } = req.body;

  if (!nombre || !email || !mensaje) {
    return res.status(400).json({ error: "Todos los campos son obligatorios." });
  }

  try {
    await transporter.sendMail({
      from: `"${nombre}" <${process.env.SMTP_USER}>`, // Remitente corporativo
      replyTo: email,                                  // Respuesta va al usuario
      to: process.env.MAIL_TO || "administrativa@bancodealimentos.co",
      subject: `Nuevo formulario de contacto — ${nombre}`,
      text: `Nombre: ${nombre}\nEmail del remitente: ${email}\n\nMensaje:\n${mensaje}`,
      html: `
        <h3>Nuevo mensaje desde el formulario de contacto</h3>
        <p><strong>Nombre:</strong> ${nombre}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Mensaje:</strong></p>
        <p>${mensaje.replace(/\n/g, "<br>")}</p>
      `,
    });

    res.json({ ok: true, message: "Correo enviado correctamente." });
  } catch (error) {
    console.error("❌ Error al enviar correo:", error.message);
    res.status(500).json({ error: "No se pudo enviar el correo." });
  }
});


app.get("/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState
  // 0=desconectado, 1=conectado, 2=conectando, 3=desconectando
  res.json({
    server: "ok",
    database: dbStatus === 1 ? "conectado" : "desconectado",
    dbState: dbStatus
  })
})

// ─── Inicio del servidor ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en el puerto ${PORT}`));