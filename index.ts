import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Filter, ObjectId } from "mongodb";

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
    const userCollection = db.collection("user");
    const sessionCollection = db.collection("session");
    const squadsCollection = db.collection("squads");
    const applicationsCollection = db.collection("applications");

    interface UserData {
      _id?: string;
      name: string;
      email: string;
      image: string;
      createdAt: Date;
      updatedAt: Date;
      role: string;
    }

    interface AuthenticatedRequest extends Request {
      user?: UserData;
    }

    // ====================  Varifications  ====================
    const verifyToken = async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) => {
      const authHeader = req.headers?.authorization;

      // check if authHeader doesn't exist
      if (!authHeader) {
        return res.status(401).send({ message: "unauthorized access" });
      }

      // Access the token
      const token = authHeader.split(" ")[1];

      // Is token doesn't exist
      if (!token) {
        return res.status(401).send({ message: "unauthorized access" });
      }

      const query = { token: token };
      const session = await sessionCollection.findOne(query);

      if (!session) {
        return res.status(401).send({ message: "unauthorized access" });
      }

      const userId = session.userId;

      const userData = {
        _id: userId,
      };

      const user = await userCollection.findOne(userData);
      if (!user) {
        return res.status(401).send({ message: "unauthorized access" });
      }

      req.user = user as UserData;
      next();
    };

    // For Admin
    const verifyAdmin = async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) => {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "forbidden access" });
      }
      next();
    };

    // For User
    const verifyUser = async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) => {
      if (req.user?.role !== "user") {
        return res.status(403).json({ message: "forbidden access" });
      }
      next();
    };

    // For User & Admin
    const verifyUserAndAdmin = async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) => {
      const allowedRoles = ["user", "admin"];
      const userRole = req.user?.role || "admin";
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ message: "forbidden access" });
      }
      next();
    };

    // ====================  Users  ====================
    // Get Users Data
    app.get("/api/users", async (req: Request, res: Response) => {
      try {
        const users = await userCollection
          .find({})
          .sort({ createdAt: -1 })
          .toArray();
        const totalUsers = await userCollection.countDocuments();

        res.status(200).json({
          success: true,
          message: "Most recent users retrieved successfully",
          data: users,
          totalUsers,
        });
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({
          success: false,
          message: "Internal server error while fetching users",
        });
      }
    });

    // Delete User Data From MongoDB
    app.delete("/api/users/:id", verifyToken, verifyAdmin, async (req: Request, res: Response) => {
      try {
        const { id } = req.params;

        if (!id) {
          return res
            .status(400)
            .send({ success: false, message: "User ID is required" });
        }

        const filter = { _id: new ObjectId(id as string) };
        const result = await userCollection.deleteOne(filter);
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

    // ====================  Squads  ====================
    // Filter Interface
    interface SquadQueryReq {
      search?: string;
      category?: string;
      tech?: string;
      teamSize?: "2" | "3" | "4" | "all";
      sort?: "latest" | "slots";
      page?: string;
      limit?: string;
    }

    // Squad Data Interface
    interface SquadData {
      _id?: string;
      projectName: string;
      category: string;
      shortDescription: string;
      fullScope: string;
      capacity: string;
      communicationLink: string;
      coverImage: string;
      techStack: string[];
      totalSlots?: number;
      joinedCount?: number;
      userId?: string;
      createdAt?: Date;
    }

    // Get Squads Data From DB
    app.get(
      "/api/squads",
      async (
        req: Request<{}, {}, {}, SquadQueryReq & { userId?: string }>,
        res: Response,
      ) => {
        try {
          const {
            search,
            category,
            tech,
            teamSize,
            sort,
            page,
            limit,
            userId,
          } = req.query;

          const query: Filter<SquadData & { userId?: string }> = {};

          // User ID
          if (userId) {
            query.userId = userId;
          }

          // Search
          if (search) {
            query.$or = [
              { projectName: { $regex: search, $options: "i" } },
              { shortDescription: { $regex: search, $options: "i" } },
              { techStack: { $regex: search, $options: "i" } },
            ];
          }

          // Category
          if (category) {
            query.category = { $regex: `^${category}$`, $options: "i" };
          }

          // Tech Stack
          if (tech) {
            query.techStack = { $regex: `^${tech}$`, $options: "i" };
          }

          // Capacity
          if (teamSize) {
            if (teamSize === "2") {
              query.capacity = "2";
            } else if (teamSize === "3") {
              query.capacity = "3";
            } else if (teamSize === "4") {
              query.capacity = { $in: ["4", "5", "6"] };
            }
          }

          // Sort data based on 'latest created' squad and slots
          let sortOptions: Record<string, 1 | -1> = { _id: -1 };
          if (sort === "slots") {
            sortOptions = { totalSlots: -1 };
          } else if (sort === "latest") {
            sortOptions = { _id: -1 };
          }

          // Pagination
          let squadsQuery = squadsCollection.find(query).sort(sortOptions);

          if (page && limit) {
            const pageNum = parseInt(page, 10) || 1;
            const limitNum = parseInt(limit, 10) || 6;
            const skipNum = (pageNum - 1) * limitNum;

            squadsQuery = squadsQuery.skip(skipNum).limit(limitNum);
          }

          // Access Data from DB
          const squads = await squadsQuery.toArray();

          // Count Total Squads
          const totalMatchingSquads =
            await squadsCollection.countDocuments(query);

          res.status(200).json({
            success: true,
            total: totalMatchingSquads,
            data: squads,
          });
        } catch (err: unknown) {
          const errorMessage =
            err instanceof Error ? err.message : "Unknown error occurred";
          res.status(500).json({
            success: false,
            message: "Internal Server Error. Something went wrong!",
            error: errorMessage,
          });
        }
      },
    );

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

    // Insert New Squad Data on DB
    app.post("/api/squads", verifyToken, verifyUser, async (req: Request, res: Response) => {
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

    // Update Squad Data From DB
    app.patch("/api/squads/:id", verifyToken, verifyUser, async (req: Request, res: Response) => {
      try {
        const { id } = req.params; // Application ID
        const { status: targetStatus } = req.body; // Status

        if (!id) {
          return res
            .status(400)
            .send({ success: false, message: "Application ID is required" });
        }

        if (!targetStatus || !["approved", "rejected"].includes(targetStatus)) {
          return res.status(400).send({
            success: false,
            message: "Valid status (approved/rejected) is required",
          });
        }

        // Get applicationsCollection Data using Application ID
        const appFilter = { _id: new ObjectId(id as string) };
        const application = await applicationsCollection.findOne(appFilter);

        if (!application) {
          return res
            .status(404)
            .send({ success: false, message: "Application not found" });
        }

        // Access the current status and squadId
        const currentStatus = application.status;
        const squadId = application.squadId;
        const userEmail = application.email;
        const userName = application.name || "Applicant";
        const squadName = application.squadName || "the Squad";
        const communicationLink =
          application.communicationLink || "No Communication Link";

        if (!squadId) {
          return res.status(400).send({
            success: false,
            message: "Squad ID not found in this application",
          });
        }

        const squadFilter = { _id: new ObjectId(squadId as string) };
        let squadUpdateDoc: any = {};

        // Update joinedCount based on status
        if (targetStatus === "approved") {
          // Check DB Status Value
          if (currentStatus !== "approved") {
            squadUpdateDoc = {
              $inc: { joinedCount: 1 },
            };
          }
        } else if (targetStatus === "rejected") {
          // check IF status value already approved than update joinedCount
          if (currentStatus === "approved") {
            squadUpdateDoc = {
              $inc: { joinedCount: -1 },
            };
          }
        }

        // Update Application Status
        await applicationsCollection.updateOne(appFilter, {
          $set: { status: targetStatus },
        });

        // If Status not approved or rejected than it works
        let squadUpdated = false;
        if (Object.keys(squadUpdateDoc).length > 0) {
          await squadsCollection.updateOne(squadFilter, squadUpdateDoc);
          squadUpdated = true;
        }

        res.status(200).send({
          success: true,
          message:
            "Application status updated and squad joinedCount Updated successfully!",
          updatedStatus: targetStatus,
          squadUpdated: squadUpdated,
          applicantData: {
            email: userEmail,
            name: userName,
            squadName: squadName,
            communicationLink: communicationLink,
          },
        });
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        console.error("Error in patch api:", err);
        res.status(500).json({
          success: false,
          message: "Internal Server Error. Something went wrong!",
          error: errorMessage,
        });
      }
    });

    // Delete Squad Data From DB
    app.delete("/api/squads/:id", verifyToken, verifyUserAndAdmin, async (req: Request, res: Response) => {
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

    // ====================  Applications  ====================
    interface GetApplicationsQuery {
      ownerId?: string;
      page?: string;
      limit?: string;
    }

    // Get Applications Data From DB
    app.get("/api/applications",
      verifyToken,
      verifyUser,
      async (req: Request<{}, {}, {}, GetApplicationsQuery>, res: Response) => {
        try {
          const { ownerId, page, limit } = req.query;

          if (!ownerId) {
            return res.status(400).json({
              success: false,
              message: "ownerId is required to fetch applications!",
            });
          }

          const pageNum = parseInt(page || "1", 10);
          const limitNum = parseInt(limit || "10", 10);
          const skipNum = (pageNum - 1) * limitNum;

          const applications = await applicationsCollection
            .find({ ownerId })
            .sort({ _id: -1 })
            .skip(skipNum)
            .limit(limitNum)
            .toArray();

          const totalMatchingApps = await applicationsCollection.countDocuments(
            {
              ownerId,
            },
          );

          res.status(200).json({
            success: true,
            total: totalMatchingApps,
            data: applications,
          });
        } catch (err: unknown) {
          const errorMessage =
            err instanceof Error ? err.message : "Unknown error occurred";
          res.status(500).json({
            success: false,
            message: "Internal Server Error. Something went wrong!",
            error: errorMessage,
          });
        }
      },
    );

    // Insert Application Data on DB
    app.post("/api/applications", verifyToken, verifyUser, async (req: Request, res: Response) => {
      try {
        const application = req.body;

        const squadData = {
          ...application,
          createdAt: new Date(),
        };

        const result = await applicationsCollection.insertOne(squadData);
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

