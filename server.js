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
const MONGO_URI = process.env.MONGODB_URI;

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

// ─── Inicio del servidor ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en el puerto ${PORT}`));