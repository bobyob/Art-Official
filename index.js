import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

const canvas = document.getElementById('drawing-board');
const toolbar = document.getElementById('toolbar');
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth - toolbar.offsetWidth;
canvas.height = window.innerHeight;

let isPainting = false;
let lineWidth = 5;
let isErasing = false;
ctx.strokeStyle = "#000000"; 
let tool = "brush";
let startX = 0;
let startY = 0;

// un/redo variable
let history = [];
let redoStack = [];
let currentStroke = [];

toolbar.addEventListener('change', e => {
  if (e.target.id === 'stroke') {
    ctx.strokeStyle = e.target.value;
  }
  if (e.target.id === 'lineWidth') {
    lineWidth = e.target.value;
  }
});

toolbar.addEventListener('click', e => {
  if (e.target.id === 'clear') {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    history = [];
    redoStack = [];
  }

  if (e.target.id === "eraser") {
    isErasing = !isErasing;
    e.target.classList.toggle("active", isErasing);
    if (isErasing) {
      e.target.textContent = "Draw";
      ctx.strokeStyle = "#FFFFFF";
    } else {
      e.target.textContent = "Eraser";
      ctx.strokeStyle = document.getElementById("stroke").value;
    }
  }

  if (e.target.id === 'brush') tool = "brush";
  if (e.target.id === 'pencil') tool = "pencil";
  if (e.target.id === 'circle') tool = "circle";
});

const draw = (e) => {
  if (!isPainting) return;
  ctx.lineWidth = tool === "pencil" ? 2 : lineWidth;
  ctx.lineCap = 'round';
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);

  // record stroke points for undo
  currentStroke.push([e.offsetX, e.offsetY]);
};

canvas.addEventListener('mousedown', (e) => {
  isPainting = true;
  startX = e.offsetX;
  startY = e.offsetY;
  currentStroke = [{ x: e.offsetX, y: e.offsetY, color: ctx.strokeStyle, width: lineWidth }];
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
});

canvas.addEventListener('mouseup', (e) => {
  if (tool === "circle") {
    let endX = e.offsetX;
    let endY = e.offsetY;
    let radius = Math.sqrt((endX - startX)**2 + (endY - startY)**2);
    ctx.beginPath();
    ctx.lineWidth = lineWidth;
    ctx.arc(startX, startY, radius, 0, Math.PI * 2);
    ctx.stroke();
    if (currentStroke.length > 0){
      history.push({points: currentStroke.slice(), color: ctx.strokeStyle, width: lineWidth})
      redoStack = [];
    } 
  }
  isPainting = false;
  ctx.beginPath();

  // save stroke to history
  if (currentStroke.length > 0) {
    history.push({ points: currentStroke.slice(), color: ctx.strokeStyle, width: lineWidth });
    redoStack = [];
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (tool !== "circle") draw(e);
});

// redraw
function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const stroke of history) {
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
    }
    ctx.stroke();
  }
}

// undo redo
function undo() {
  if (history.length > 0) {
    const stroke = history.pop();
    redoStack.push(stroke);
    redraw();
  }
}

function redo() {
  if (redoStack.length > 0) {
    const stroke = redoStack.pop();
    history.push(stroke);
    redraw();
  }
}

// keyboard short cuts
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
  }
  if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
    e.preventDefault();
    redo();
  }
});

// apint brush
const cursor = document.querySelector(".cursor");
canvas.addEventListener("mousemove", (e) => {
  const { width, height } = cursor.getBoundingClientRect();
  cursor.style.left = `${e.clientX - width / 2}px`;
  cursor.style.top = `${e.clientY - height / 2}px`;
});

// text
let isTextMode = false;
document.getElementById('textTool').addEventListener('click', () => {
  isTextMode = !isTextMode;
  document.getElementById('textTool').style.backgroundColor = isTextMode ? 'red' : 'blue';
});
canvas.addEventListener('click', (e) => {
  if (isTextMode) {
    const text = prompt("Enter your text:");
    if (text) {
      ctx.font = `${lineWidth * 5}px Arial`;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(text, e.offsetX, e.offsetY);
    }
  }
});

// save
document.getElementById('save').addEventListener('click', () => {
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  tempCtx.fillStyle = '#ffffff';
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  tempCtx.drawImage(canvas, 0, 0);
  const imageData = tempCanvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = imageData;
  link.download = 'drawing.png';
  link.click();
});

// ai chat
const aiChat = document.getElementById("ai-chat");
const aiButton = document.getElementById("aiInsights");
const closeChat = document.getElementById("closeChat");
const sendMessageBtn = document.getElementById("sendMessage");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");
const apiKey = "AIzaSyBNz70clKxmnqKKujT_82_8JirB8XziljE";

const genAI = new GoogleGenerativeAI({ apiKey });

aiButton.addEventListener("click", async () => {
  aiChat.classList.add("open");
  addMessage("Analyzing your drawing in 100 words or less", "user");
  const typingDiv = showTyping();

  const canvas = document.getElementById("drawing-board");
  const imageData = canvas.toDataURL("image/png").split(",")[1];

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent([
      { inlineData: { mimeType: "image/png", data: imageData } },
      { text: "Provide artistic feedback (under 100 words) to help improve this drawing." },
    ]);
    const reply = await result.response.text();
    typingDiv.remove();
    addMessage(reply, "ai");
  } catch (error) {
    console.error("Error analyzing drawing:", error);
    typingDiv.remove();
    addMessage("Something went wrong analyzing your drawing.", "ai");
  }
});

closeChat.addEventListener("click", () => {
  aiChat.classList.remove("open");
});

function addMessage(message, className){
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message", className);
  msgDiv.textContent = message;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = aiChat.scrollHeight;
}

function showTyping() {
  const typingDiv = document.createElement("div");
  typingDiv.classList.add("message", "ai");
  typingDiv.textContent = "Typing...";
  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return typingDiv;
}

async function getBotReply(userMessage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const fullPrompt = `${userMessage}\n\nPlease respond in under 100 words and act like an art teacher teaching an student. Omit all markdown/syntaxxing (bold, italics, underline)`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }]
      })
    });
    const data = await response.json();
    console.log("Gemini API response:", data);
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No reply.";
  } catch (error) {
    console.error("Error fetching AI reply:", error);
    return "Sorry, something went wrong.";
  }
}

sendMessageBtn.onclick = async () => {
  const message = chatInput.value.trim();
  if (message === "") return;
  addMessage(message, "user");
  chatInput.value = "";
  const typingDiv = showTyping();
  const botreply = await getBotReply(message);
  typingDiv.remove();
  addMessage(botreply, "ai");
  localStorage.setItem("chatHistory", chatMessages.innerHTML);
};

chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessageBtn.click();
});
