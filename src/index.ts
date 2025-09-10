import express from "express";
import { Server } from "socket.io";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: [
      process.env.CORS_ORIGIN!,
      process.env.CORS_ORIGIN_PROD!,
      "https://t.me",
    ],
    credentials: true,
  })
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.CORS_ORIGIN!,
      process.env.CORS_ORIGIN_PROD!,
      "https://t.me",
    ],
    credentials: true,
  },
});

// Хранилище игр
interface Game {
  player1: string;
  player2: string | null;
  fen: string;
  currentTurn: "white" | "black";
}

const games: Record<string, Game> = {};

io.on("connection", (socket) => {
  console.log("Пользователь подключился:", socket.id);

  // Создать игру
  socket.on("createGame", (userId: string) => {
    const gameId = Math.random().toString(36).substring(2, 9).toUpperCase();
    games[gameId] = {
      player1: userId,
      player2: null,
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      currentTurn: "white",
    };
    socket.join(gameId);
    socket.emit("gameCreated", { gameId });
  });

  // Присоединиться к игре
  socket.on(
    "joinGame",
    ({ gameId, userId }: { gameId: string; userId: string }) => {
      const game = games[gameId];
      if (!game) {
        socket.emit("error", "Игра не найдена");
        return;
      }
      if (game.player2) {
        socket.emit("error", "Игра уже занята");
        return;
      }
      game.player2 = userId;
      socket.join(gameId);
      io.to(gameId).emit("gameStarted", {
        players: { white: game.player1, black: game.player2 },
        fen: game.fen, // 👈 Отправляем FEN
        turn: game.currentTurn, // 👈 Отправляем turn
      });
    }
  );

  // Ход
  socket.on("makeMove", (data) => {
    const { gameId, from, to, fen, turn } = data;
    const game = games[gameId];
    if (!game) return;

    // Обновляем FEN и turn
    game.fen = fen;
    game.currentTurn = turn;

    // Отправляем событие всем игрокам
    io.to(gameId).emit("moveMade", { fen, turn });
  });

  socket.on("disconnect", () => {
    console.log("Пользователь отключился:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
