import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Route for Email Notification (Called from frontend after saving to Firestore)
  app.post("/api/quote", async (req, res) => {
    const { quoteData } = req.body;
    
    const message = `
[신규 견적 신청 알림]
--------------------
출발지: ${quoteData.origin}
도착지: ${quoteData.destination}
톤수: ${quoteData.tonnage}
차종: ${quoteData.vehicleBody}
화물내용: ${quoteData.cargoDetails || '없음'}
고객 연락처: ${quoteData.contact}

예상운임: ${quoteData.estimatedFare.toLocaleString()}원
거리: 약 ${quoteData.distance.toFixed(1)}km
--------------------
관리자(chapro59)님, 위 견적 내용을 확인해 주세요.
    `;

    console.log("----------------------------------------");
    console.log("🔔 [신규 견적 신청 알림]");
    console.log(message);
    console.log("----------------------------------------");

    // Send Email via Resend if API Key is provided
    if (resend) {
      try {
        await resend.emails.send({
          from: "FreightApp <onboarding@resend.dev>",
          to: "chapro59@gmail.com",
          subject: "[신규 견적 신청] 전국특송화물 알림",
          text: message,
        });
        console.log("✅ 이메일 알림이 성공적으로 전송되었습니다.");
      } catch (error) {
        console.error("❌ 이메일 전송 실패:", error);
      }
    }

    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
