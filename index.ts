import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { ObjectId } from "mongodb";

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
    // Get 4 Squad Data From DB
    app.get("/api/four-squads", async (req: Request, res: Response) => {
      try {
        const squads = await squadsCollection
          .find()
          .sort({ _id: -1 })
          .limit(4)
          .toArray();
        res.status(200).json(squads);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        res.status(500).json({
          success: false,
          message: "Internal Server Error. Something went wrong!",
          error: errorMessage,
        });
      }
    });

    // Get Squads Data From DB
    app.get("/api/squads", async (req: Request, res: Response) => {
      try {
        const squads = await squadsCollection
          .find()
          .sort({ _id: -1 })
          .toArray();
        res.status(200).json(squads);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        res.status(500).json({
          success: false,
          message: "Internal Server Error. Something went wrong!",
          error: errorMessage,
        });
      }
    });

    // Insert New Squad Data on DB
    app.post("/api/squads", async (req: Request, res: Response) => {
      try {
        const squad = req.body;

        const parsedCapacity = squad.capacity
          ? parseInt(squad.capacity, 10)
          : 4;

        const squadData = {
          ...squad,
          totalSlots: parsedCapacity,
          joinedCount: 1,
          createdAt: new Date(),
        };

        const result = await squadsCollection.insertOne(squadData);
        res.status(201).json(result);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        res.status(500).json({
          success: false,
          message: "Internal Server Error. Something went wrong!",
          error: errorMessage,
        });
      }
    });

    // Delete Squad Data From DB
    app.delete("/api/squads/:id", async (req: Request, res: Response) => {
      try {
        const { id } = req.params;

        if (!id) {
          return res
            .status(400)
            .send({ success: false, message: "Squad ID is required" });
        }

        const filter = { _id: new ObjectId(id as string) };
        const result = await squadsCollection.deleteOne(filter);
        res.status(200).send(result);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
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
