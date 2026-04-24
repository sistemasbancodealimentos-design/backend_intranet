// server.js
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGODB_URI;

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 5000, // Tiempo de espera de 5 segundos 
  socketTimeoutMS: 45000,         // Mantiene la conexión activa 
})
.then(() => console.log('✅ Conexión exitosa a la Intranet en MongoDB Atlas '))
.catch(err => {
  console.error('❌ Error de conexión:', err.message);
});

app.post("/send-email", async (req, res) => {
  const { nombre, email, mensaje } = req.body;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "cestobon991@gmail.com",
      pass: "cesar1991tobon"
    }
  });

  try {
    await transporter.sendMail({
      from: email,
      to: "administrativa@bancodealimentos.co",
      subject: "Nuevo formulario",
      text: `Nombre: ${nombre}\nEmail: ${email}\nMensaje: ${mensaje}`
    });

    res.send("Correo enviado");
  } catch (error) {
    res.status(500).send(error);
  }
});

app.listen(3000, () => console.log("Servidor corriendo"));