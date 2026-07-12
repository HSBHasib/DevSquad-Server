import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middlewares
app.use(express.json());
app.use(cors());

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server
    await client.connect();

    // Connect to DB
    const db = client.db(process.env.DB_NAME);

    // Create or Access to DB Collections
    const squadsCollection = db.collection("squads");

    // ====================  Squads  ====================
    // Insert New Squad Data on DB
    app.post("/api/squads", async (req: Request, res: Response) => {
      try {
        const squad = req.body;
        const squadData = {
          ...squad,
          createdAt: new Date(),
        };
        const result = await squadsCollection.insertOne(squadData);
        res.status(201).json(result);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
        res.status(500).json({
          success: false,
          message: "Internal Server Error. Something went wrong!",
          error: errorMessage,
        });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req: Request, res: Response) => {
  res.send("Backend server is running successfully!");
});

// Listener
app.listen(PORT, () => {
  console.log(`Server is running on: ${PORT}`);
});
