import "dotenv/config";

import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

import { reviewRepository } from "./services/repository-review.service";
import { getFileContent } from "./services/github-content.service";
import { analyzeCode } from "./services/code-analyzer.service";
import {
  getRepository,
  getRepositoryFiles,
} from "./services/github.service";

import { filterSourceFiles } from "./services/file-filter.service";

const app = express();
const PORT = 5000;

/* ========================================
   MIDDLEWARE
======================================== */

app.use(cors());
app.use(express.json());

/* ========================================
   HTTP SERVER
======================================== */

const server = http.createServer(app);

/* ========================================
   SOCKET.IO
======================================== */

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

/* ========================================
   LIVE DEVELOPER COUNT
======================================== */

let activeDevelopers = 0;

io.on("connection", (socket) => {
  activeDevelopers++;

  console.log(
    `🟢 Developer connected: ${socket.id}`
  );

  console.log(
    `👨‍💻 Developers online: ${activeDevelopers}`
  );

  // Send the current count to EVERY connected client
  io.emit("live-users", activeDevelopers);

  socket.on("disconnect", () => {
    activeDevelopers = Math.max(
      0,
      activeDevelopers - 1
    );

    console.log(
      `🔴 Developer disconnected: ${socket.id}`
    );

    console.log(
      `👨‍💻 Developers online: ${activeDevelopers}`
    );

    // Update everyone
    io.emit("live-users", activeDevelopers);
  });
});

/* ========================================
   HEALTH
======================================== */

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "DevGuardian API is running 🚀",
  });
});

/* ========================================
   TEST
======================================== */

app.get("/api/test", (_req, res) => {
  res.json({
    success: true,
    message: "Test route works 🚀",
  });
});

/* ========================================
   GET REPOSITORY FILES
======================================== */

app.get(
  "/api/repositories/:owner/:repo/files",
  async (req, res) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;

      const files = await getRepositoryFiles(
        owner,
        repo
      );

      const sourceFiles = filterSourceFiles(files);

      res.json({
        success: true,
        totalFiles: files.length,
        sourceFiles: sourceFiles.length,
        files: sourceFiles,
      });
    } catch (error) {
      console.error(
        "GitHub file scanner error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to retrieve repository files",
      });
    }
  }
);

/* ========================================
   REVIEW SINGLE FILE
======================================== */

app.get(
  "/api/repositories/:owner/:repo/review-file",
  async (req, res) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const path = req.query.path as string;

      if (!path) {
        return res.status(400).json({
          success: false,
          message: "File path is required",
        });
      }

      const file = await getFileContent(
        owner,
        repo,
        path
      );

      const analysis = analyzeCode(
        file.path,
        file.code
      );

      res.json({
        success: true,
        file: {
          path: file.path,
          size: file.size,
        },
        analysis,
      });
    } catch (error) {
      console.error(
        "Code analysis error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to analyze file",
      });
    }
  }
);

/* ========================================
   REVIEW ENTIRE REPOSITORY
======================================== */

app.post(
  "/api/repositories/:owner/:repo/review",
  async (req, res) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;

      const report = await reviewRepository(
        owner,
        repo
      );

      res.json({
        success: true,
        report,
      });
    } catch (error) {
      console.error(
        "Repository review error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to review repository",
      });
    }
  }
);

/* ========================================
   START SERVER
======================================== */

server.listen(PORT, () => {
  console.log(
    `🚀 DevGuardian API running on http://localhost:${PORT}`
  );

  console.log(
    `⚡ WebSocket server ready for live developers`
  );
});