import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import { db } from "./prisma/db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(helmet());

app.get("/", (req, res) => {
  res.json({
    message: "Energy Manager API is running",
  });
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await db.orm.public.User.all();

    res.json(users);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to load users",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});