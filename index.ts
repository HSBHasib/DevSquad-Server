import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middlewares
app.use(express.json());
app.use(cors());

app.get("/", (req: Request, res: Response) => {
  res.send("Backend server is running successfully!");
});

// Listener
app.listen(PORT, () => {
  console.log(`Server is running on: ${PORT}`);
});
