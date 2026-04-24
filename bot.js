const fs = require("fs");
const path = require("path");
const express = require("express");

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  Events,
  EmbedBuilder
} = require("discord.js");

// =========================
// CHANGE THESE VALUES
// =========================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1496600113638932520";
const GUILD_ID = "1495883300978294968";
const ROLE_ID = "1495901658469765291";

// Replace AFTER hosting
const APP_URL = "https://panel-bot-production.up.railway.app";

// =========================
// FILE PATHS
// =========================
const KEYS_FILE = path.join(__dirname, "keys.json");
const HWID_RESETS_FILE = path.join(__dirname, "hwidResets.json");

// =========================
// EXPRESS SERVER
// =========================
const app = express();
const PORT = process.env.PORT || 3000;

// TEMP SCRIPT (replace later)
let SCRIPT = `
if not game:IsLoaded() then game.Loaded:Wait() end
pcall(function() game:GetService("Players").RespawnTime = 0 end)
local privateBuild = false


-- Zawa's Remote Sell
-- Auto-refreshes when new brainrots appear on podiums.

local Players = game:GetService("Players")
local player = Players.LocalPlayer

-- ===================== FIND PLOT =====================
local lockedPlot = nil

local function findMyPlot()
    if lockedPlot and lockedPlot.Parent then return lockedPlot end

    local plots = workspace:FindFirstChild("Plots")
    if not plots then return nil end

    local myName = player.Name:lower()
    local myId = tostring(player.UserId)
    local myDisplayName = player.DisplayName:lower()

    for _, plot in ipairs(plots:GetChildren()) do
        for _, v in ipairs(plot:GetDescendants()) do
            if v:IsA("StringValue") then
                local val = tostring(v.Value):lower()
                if val == myName or val == myId or val == myDisplayName then
                    lockedPlot = plot
                    return plot
                end
                local vname = v.Name:lower()
                if vname:find("owner") or vname:find("player") or vname:find("user") then
                    if val == myName or val == myId or val == myDisplayName then
                        lockedPlot = plot
                        return plot
                    end
                end
            elseif v:IsA("IntValue") then
                if tostring(v.Value) == myId then
                    lockedPlot = plot
                    return plot
                end
            elseif v:IsA("ObjectValue") then
                if v.Value == player then
                    lockedPlot = plot
                    return plot
                end
            end
        end
    end

    -- Closest plot fallback
    local char = player.Character or player.CharacterAdded:Wait()
    local root = char:FindFirstChild("HumanoidRootPart")
    if root then
        local closest, closestDist = nil, math.huge
        for _, plot in ipairs(plots:GetChildren()) do
            local ok, pos = pcall(function() return plot:GetPivot().Position end)
            if ok then
                local dist = (pos - root.Position).Magnitude
                if dist < closestDist then
                    closest = plot
                    closestDist = dist
                end
            end
        end
        if closest then
            lockedPlot = closest
            return closest
        end
    end

    return nil
end

-- ===================== BUILD GUI =====================
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "RemoteSellGUI"
screenGui.ResetOnSpawn = false
screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
screenGui.Parent = player:WaitForChild("PlayerGui")

local SAVE_FILE = "zawa's_sell_pos2.txt"
local FRAME_W, FRAME_H = 265, 445
local screenSize = workspace.CurrentCamera.ViewportSize

local function clampPos(x, y)
    x = math.clamp(x, 0, screenSize.X - FRAME_W)
    y = math.clamp(y, 0, screenSize.Y - FRAME_H)
    return x, y
end

local savedX, savedY = nil, nil
local ok, data = pcall(readfile, SAVE_FILE)
if ok and data then
    local x, y = data:match("(-?[%d%.]+),(-?[%d%.]+)")
    if x and y then
        savedX, savedY = clampPos(tonumber(x), tonumber(y))
    end
end

local mainFrame = Instance.new("Frame")
mainFrame.Size = UDim2.new(0, FRAME_W, 0, FRAME_H)
mainFrame.Position = (savedX and savedY)
    and UDim2.new(0, savedX, 0, savedY)
    or UDim2.new(0.5, -132, 0.5, -219)
mainFrame.BackgroundColor3 = Color3.fromRGB(10, 14, 22)
mainFrame.BorderSizePixel = 0
mainFrame.Active = true
mainFrame.Draggable = false
mainFrame.ZIndex = 2
mainFrame.Parent = screenGui
Instance.new("UICorner", mainFrame).CornerRadius = UDim.new(0, 12)

-- Cyan border stroke
local stroke = Instance.new("UIStroke")
stroke.Color = Color3.fromRGB(0, 200, 230)
stroke.Thickness = 1.5
stroke.Transparency = 0.5
stroke.Parent = mainFrame

-- Custom drag with clamping and position saving
do
    local dragging, dragStart, startPos
    mainFrame.InputBegan:Connect(function(input)
        if input.UserInputType == Enum.UserInputType.MouseButton1 then
            dragging = true
            dragStart = input.Position
            startPos = mainFrame.Position
        end
    end)
    game:GetService("UserInputService").InputChanged:Connect(function(input)
        if dragging and input.UserInputType == Enum.UserInputType.MouseMovement then
            local delta = input.Position - dragStart
            local rawX = startPos.X.Offset + delta.X
            local rawY = startPos.Y.Offset + delta.Y
            local cx, cy = clampPos(rawX, rawY)
            mainFrame.Position = UDim2.new(0, cx, 0, cy)
        end
    end)
    game:GetService("UserInputService").InputEnded:Connect(function(input)
        if input.UserInputType == Enum.UserInputType.MouseButton1 and dragging then
            dragging = false
            pcall(writefile, SAVE_FILE, mainFrame.Position.X.Offset .. "," .. mainFrame.Position.Y.Offset)
        end
    end)
end

-- Cyan accent line under title bar
local accentLine = Instance.new("Frame")
accentLine.Size = UDim2.new(1, 0, 0, 2)
accentLine.Position = UDim2.new(0, 0, 0, 48)
accentLine.BackgroundColor3 = Color3.fromRGB(0, 200, 230)
accentLine.BorderSizePixel = 0
accentLine.ZIndex = 3
accentLine.Parent = mainFrame

-- Title bar
local titleBar = Instance.new("Frame")
titleBar.Size = UDim2.new(1, 0, 0, 48)
titleBar.BackgroundColor3 = Color3.fromRGB(12, 20, 32)
titleBar.BorderSizePixel = 0
titleBar.ZIndex = 3
titleBar.Parent = mainFrame
Instance.new("UICorner", titleBar).CornerRadius = UDim.new(0, 12)

-- Cyan dot decoration
local dot = Instance.new("Frame")
dot.Size = UDim2.new(0, 8, 0, 8)
dot.Position = UDim2.new(0, 14, 0.5, -4)
dot.BackgroundColor3 = Color3.fromRGB(0, 200, 230)
dot.BorderSizePixel = 0
dot.ZIndex = 4
dot.Parent = titleBar
Instance.new("UICorner", dot).CornerRadius = UDim.new(1, 0)

-- Title label
local titleLabel = Instance.new("TextLabel")
titleLabel.Size = UDim2.new(1, -80, 1, 0)
titleLabel.Position = UDim2.new(0, 30, 0, 0)
titleLabel.BackgroundTransparency = 1
titleLabel.Text = "ZAWA'S REMOTE SELL"
titleLabel.TextColor3 = Color3.fromRGB(0, 220, 255)
titleLabel.Font = Enum.Font.GothamBlack
titleLabel.TextSize = 15
titleLabel.TextXAlignment = Enum.TextXAlignment.Left
titleLabel.ZIndex = 4
titleLabel.Parent = titleBar

-- Close button
local closeBtn = Instance.new("TextButton")
closeBtn.Size = UDim2.new(0, 26, 0, 26)
closeBtn.Position = UDim2.new(1, -34, 0.5, -13)
closeBtn.BackgroundColor3 = Color3.fromRGB(0, 160, 200)
closeBtn.Text = "✕"
closeBtn.TextColor3 = Color3.new(1, 1, 1)
closeBtn.Font = Enum.Font.GothamBold
closeBtn.TextSize = 12
closeBtn.BorderSizePixel = 0
closeBtn.ZIndex = 4
closeBtn.Parent = titleBar
Instance.new("UICorner", closeBtn).CornerRadius = UDim.new(0, 6)
closeBtn.MouseButton1Click:Connect(function()
    screenGui:Destroy()
end)

-- Status label
local statusLabel = Instance.new("TextLabel")
statusLabel.Size = UDim2.new(1, -20, 0, 22)
statusLabel.Position = UDim2.new(0, 10, 0, 54)
statusLabel.BackgroundTransparency = 1
statusLabel.Text = "Scanning..."
statusLabel.TextColor3 = Color3.fromRGB(80, 180, 210)
statusLabel.Font = Enum.Font.Gotham
statusLabel.TextSize = 11
statusLabel.TextXAlignment = Enum.TextXAlignment.Left
statusLabel.ZIndex = 3
statusLabel.Parent = mainFrame

-- Scroll frame
local scrollFrame = Instance.new("ScrollingFrame")
scrollFrame.Size = UDim2.new(1, -18, 1, -112)
scrollFrame.Position = UDim2.new(0, 9, 0, 80)
scrollFrame.BackgroundColor3 = Color3.fromRGB(14, 20, 30)
scrollFrame.BorderSizePixel = 0
scrollFrame.ScrollBarThickness = 3
scrollFrame.ScrollBarImageColor3 = Color3.fromRGB(0, 200, 230)
scrollFrame.CanvasSize = UDim2.new(0, 0, 0, 0)
scrollFrame.ZIndex = 3
scrollFrame.Parent = mainFrame
Instance.new("UICorner", scrollFrame).CornerRadius = UDim.new(0, 8)

local listLayout = Instance.new("UIListLayout")
listLayout.SortOrder = Enum.SortOrder.LayoutOrder
listLayout.Padding = UDim.new(0, 5)
listLayout.Parent = scrollFrame

local listPadding = Instance.new("UIPadding")
listPadding.PaddingTop = UDim.new(0, 6)
listPadding.PaddingBottom = UDim.new(0, 6)
listPadding.PaddingLeft = UDim.new(0, 6)
listPadding.PaddingRight = UDim.new(0, 6)
listPadding.Parent = scrollFrame

listLayout:GetPropertyChangedSignal("AbsoluteContentSize"):Connect(function()
    scrollFrame.CanvasSize = UDim2.new(0, 0, 0, listLayout.AbsoluteContentSize.Y + 12)
end)

-- Credit label at bottom
local creditLabel = Instance.new("TextLabel")
creditLabel.Size = UDim2.new(1, 0, 0, 20)
creditLabel.Position = UDim2.new(0, 0, 1, -22)
creditLabel.BackgroundTransparency = 1
creditLabel.Text = "made by @zawaskyee"
creditLabel.TextColor3 = Color3.fromRGB(0, 180, 210)
creditLabel.Font = Enum.Font.Gotham
creditLabel.TextSize = 10
creditLabel.TextXAlignment = Enum.TextXAlignment.Center
creditLabel.ZIndex = 3
creditLabel.Parent = mainFrame

-- ===================== SCAN & POPULATE =====================

-- Track which podium numbers are currently shown
local shownPodiums = {}

local function addRow(podiumNum, sellPrompt, sellText)
    local row = Instance.new("Frame")
    row.Size = UDim2.new(1, -12, 0, 40)
    row.BackgroundColor3 = Color3.fromRGB(16, 26, 40)
    row.BorderSizePixel = 0
    row.LayoutOrder = podiumNum
    row.ZIndex = 4
    row.Name = "PodiumRow_" .. podiumNum
    row.Parent = scrollFrame
    Instance.new("UICorner", row).CornerRadius = UDim.new(0, 7)

    -- Cyan left border accent
    local leftAccent = Instance.new("Frame")
    leftAccent.Size = UDim2.new(0, 3, 1, -8)
    leftAccent.Position = UDim2.new(0, 0, 0, 4)
    leftAccent.BackgroundColor3 = Color3.fromRGB(0, 200, 230)
    leftAccent.BorderSizePixel = 0
    leftAccent.ZIndex = 5
    leftAccent.Parent = row
    Instance.new("UICorner", leftAccent).CornerRadius = UDim.new(0, 2)

    -- Slot number badge
    local badge = Instance.new("TextLabel")
    badge.Size = UDim2.new(0, 28, 0, 28)
    badge.Position = UDim2.new(0, 10, 0.5, -14)
    badge.BackgroundColor3 = Color3.fromRGB(10, 40, 60)
    badge.Text = tostring(podiumNum)
    badge.TextColor3 = Color3.fromRGB(0, 210, 245)
    badge.Font = Enum.Font.GothamBlack
    badge.TextSize = 12
    badge.BorderSizePixel = 0
    badge.ZIndex = 5
    badge.Parent = row
    Instance.new("UICorner", badge).CornerRadius = UDim.new(0, 5)

    -- Sell text label
    local nameLabel = Instance.new("TextLabel")
    nameLabel.Size = UDim2.new(1, -110, 1, 0)
    nameLabel.Position = UDim2.new(0, 46, 0, 0)
    nameLabel.BackgroundTransparency = 1
    nameLabel.Text = sellText
    nameLabel.TextColor3 = Color3.fromRGB(180, 225, 240)
    nameLabel.Font = Enum.Font.Gotham
    nameLabel.TextSize = 11
    nameLabel.TextXAlignment = Enum.TextXAlignment.Left
    nameLabel.TextTruncate = Enum.TextTruncate.AtEnd
    nameLabel.ZIndex = 5
    nameLabel.Parent = row

    -- Sell button
    local sellBtn = Instance.new("TextButton")
    sellBtn.Size = UDim2.new(0, 56, 0, 28)
    sellBtn.Position = UDim2.new(1, -62, 0.5, -14)
    sellBtn.BackgroundColor3 = Color3.fromRGB(0, 160, 200)
    sellBtn.Text = "SELL"
    sellBtn.TextColor3 = Color3.new(1, 1, 1)
    sellBtn.Font = Enum.Font.GothamBold
    sellBtn.TextSize = 11
    sellBtn.BorderSizePixel = 0
    sellBtn.ZIndex = 5
    sellBtn.Parent = row
    Instance.new("UICorner", sellBtn).CornerRadius = UDim.new(0, 6)

    sellBtn.MouseButton1Click:Connect(function()
        local sellOk = pcall(function()
            fireproximityprompt(sellPrompt)
        end)
        if sellOk then
            sellBtn.Text = "✓"
            sellBtn.BackgroundColor3 = Color3.fromRGB(20, 160, 60)
            task.wait(0.4)
            shownPodiums[podiumNum] = nil
            row:Destroy()
            -- Update status count
            local remaining = 0
            for _ in pairs(shownPodiums) do remaining = remaining + 1 end
            if remaining == 0 then
                statusLabel.Text = "No brainrots on podiums"
            else
                statusLabel.Text = remaining .. " brainrot(s) ready to sell"
            end
        else
            sellBtn.Text = "ERR"
            sellBtn.BackgroundColor3 = Color3.fromRGB(80, 0, 30)
            task.wait(1)
            sellBtn.Text = "SELL"
            sellBtn.BackgroundColor3 = Color3.fromRGB(0, 160, 200)
        end
    end)
end

local function scan()
    local plot = findMyPlot()
    if not plot then
        statusLabel.Text = "❌ Base not found"
        return
    end

    local podiums = plot:FindFirstChild("AnimalPodiums")
    if not podiums then
        statusLabel.Text = "❌ AnimalPodiums not found"
        return
    end

    local newFound = 0

    for _, podium in ipairs(podiums:GetChildren()) do
        local podiumNum = tonumber(podium.Name)
        if podiumNum and not shownPodiums[podiumNum] then
            local base = podium:FindFirstChild("Base")
            local spawn = base and base:FindFirstChild("Spawn")
            local attachment = spawn and spawn:FindFirstChild("PromptAttachment")

            if attachment then
                for _, pp in ipairs(attachment:GetChildren()) do
                    if pp:IsA("ProximityPrompt") then
                        local action = pp.ActionText or ""
                        if action:sub(1, 4) == "Sell" then
                            shownPodiums[podiumNum] = true
                            addRow(podiumNum, pp, action)
                            newFound = newFound + 1
                        end
                    end
                end
            end
        end
    end

    -- Count total shown
    local total = 0
    for _ in pairs(shownPodiums) do total = total + 1 end

    if total == 0 then
        statusLabel.Text = "No brainrots on podiums"
    else
        statusLabel.Text = total .. " brainrot(s) ready to sell"
    end
end

local function hasSellPrompt(plot)
    local podiums = plot:FindFirstChild("AnimalPodiums")
    if not podiums then return false end
    for _, podium in ipairs(podiums:GetChildren()) do
        if tonumber(podium.Name) then
            local base = podium:FindFirstChild("Base")
            local spawn = base and base:FindFirstChild("Spawn")
            local attachment = spawn and spawn:FindFirstChild("PromptAttachment")
            if attachment then
                for _, pp in ipairs(attachment:GetChildren()) do
                    if pp:IsA("ProximityPrompt") and (pp.ActionText or ""):sub(1, 4) == "Sell" then
                        return true
                    end
                end
            end
        end
    end
    return false
end

-- ===================== AUTO-REFRESH WATCHER =====================
-- Watches for new proximity prompts added to podiums after initial load
local watcherConnection = nil

local function startWatcher(plot)
    if watcherConnection then
        watcherConnection:Disconnect()
        watcherConnection = nil
    end

    local podiums = plot:FindFirstChild("AnimalPodiums")
    if not podiums then return end

    -- Watch each podium's PromptAttachment for new ProximityPrompts
    local function watchPodium(podium)
        local podiumNum = tonumber(podium.Name)
        if not podiumNum then return end

        local base = podium:FindFirstChild("Base")
        local spawn = base and base:FindFirstChild("Spawn")
        local attachment = spawn and spawn:FindFirstChild("PromptAttachment")
        if not attachment then return end

        attachment.ChildAdded:Connect(function(child)
            task.wait(0.1) -- small delay for properties to settle
            if child:IsA("ProximityPrompt") then
                local action = child.ActionText or ""
                if action:sub(1, 4) == "Sell" and not shownPodiums[podiumNum] then
                    shownPodiums[podiumNum] = true
                    addRow(podiumNum, child, action)
                    local total = 0
                    for _ in pairs(shownPodiums) do total = total + 1 end
                    statusLabel.Text = total .. " brainrot(s) ready to sell"
                end
            end
        end)

        -- Also watch if a sold/removed prompt comes back
        attachment.ChildRemoved:Connect(function(child)
            if child:IsA("ProximityPrompt") and (child.ActionText or ""):sub(1, 4) == "Sell" then
                shownPodiums[podiumNum] = nil
                -- Remove the row if it still exists
                local existingRow = scrollFrame:FindFirstChild("PodiumRow_" .. podiumNum)
                if existingRow then existingRow:Destroy() end
                local total = 0
                for _ in pairs(shownPodiums) do total = total + 1 end
                if total == 0 then
                    statusLabel.Text = "No brainrots on podiums"
                else
                    statusLabel.Text = total .. " brainrot(s) ready to sell"
                end
            end
        end)
    end

    for _, podium in ipairs(podiums:GetChildren()) do
        watchPodium(podium)
    end

    -- Also watch for new podiums being added
    podiums.ChildAdded:Connect(function(podium)
        task.wait(0.2)
        watchPodium(podium)
        -- Check if it already has a sell prompt
        scan()
    end)
end

-- ===================== LOAD =====================
task.spawn(function()
    local char = player.Character or player.CharacterAdded:Wait()
    local root = char:WaitForChild("HumanoidRootPart", 15)
    if not root then
        statusLabel.Text = "❌ Character didn't load"
        return
    end

    local plots = workspace:WaitForChild("Plots", 30)
    if not plots then
        statusLabel.Text = "❌ Plots not found"
        return
    end

    for i = 1, 40 do
        if #plots:GetChildren() > 0 then break end
        task.wait(0.5)
    end

    local myPlot = findMyPlot()
    if not myPlot then
        statusLabel.Text = "❌ Could not find your base"
        return
    end

    statusLabel.Text = "Loading brainrots..."

    -- Wait for initial sell prompts
    for i = 1, 60 do
        if hasSellPrompt(myPlot) then break end
        task.wait(0.5)
        if i == 60 then
            statusLabel.Text = "No brainrots on podiums"
            -- Still start watcher so it catches future additions
            startWatcher(myPlot)
            return
        end
    end

    scan()
    startWatcher(myPlot)
end)

`;

function loadKeys() {
  return JSON.parse(fs.readFileSync(KEYS_FILE, "utf8"));
}

app.get("/hub", (req, res) => {
  const key = req.query.key;
  const keys = loadKeys();

  if (!key || !keys[key]) {
    return res.send('print("Invalid key")');
  }

  if (!keys[key].usedBy) {
    return res.send('print("Key not redeemed")');
  }

  if (!keys[key].scriptAccess) {
    return res.send('print("No access")');
  }

  return res.type("text/plain").send(SCRIPT);
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

// =========================
// RESET SYSTEM
// =========================
const RESET_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function loadResets() {
  return JSON.parse(fs.readFileSync(HWID_RESETS_FILE, "utf8"));
}

function saveResets(data) {
  fs.writeFileSync(HWID_RESETS_FILE, JSON.stringify(data, null, 2));
}

function saveKeys(data) {
  fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2));
}

function hasRedeemed(userId) {
  const keys = loadKeys();
  return Object.values(keys).some(v => v.usedBy === userId);
}

function getUserKey(userId) {
  const keys = loadKeys();

  for (const [key, value] of Object.entries(keys)) {
    if (value.usedBy === userId) return key;
  }

  return null;
}

function getRemainingResetTime(lastReset) {
  const remaining = RESET_COOLDOWN_MS - (Date.now() - lastReset);
  if (remaining <= 0) return null;

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m`;
}

// =========================
// DISCORD CLIENT
// =========================
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// =========================
// REGISTER COMMAND
// =========================
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("panel")
      .setDescription("Open user panel")
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("/panel registered");
}

// =========================
// READY
// =========================
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// =========================
// INTERACTIONS
// =========================
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // PANEL
    if (interaction.isChatInputCommand() && interaction.commandName === "panel") {
      const embed = new EmbedBuilder()
        .setColor(0x2f6df6)
        .setTitle("User Panel")
        .setDescription(
          [
            "Welcome! Use the buttons below to manage your key.",
            "",
            "Redeem Key - Link a key to your Discord account.",
            "Get Script - Get the script with your key.",
            "Reset HWID - Reset your locked HWID (usable once every 24h)."
          ].join("\n")
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("redeem_key").setLabel("Redeem Key").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("get_script").setLabel("Get Script").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("reset_hwid").setLabel("Reset HWID").setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    // BUTTONS
    if (interaction.isButton()) {

      if (interaction.customId === "redeem_key") {
        const modal = new ModalBuilder()
          .setCustomId("redeem_modal")
          .setTitle("Redeem Key");

        const input = new TextInputBuilder()
          .setCustomId("key_input")
          .setLabel("Enter your key")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));

        await interaction.showModal(modal);
        return;
      }

      if (interaction.customId === "get_script") {
        if (!hasRedeemed(interaction.user.id)) {
          return interaction.reply({ content: "Redeem a valid key first.", ephemeral: true });
        }

        const userKey = getUserKey(interaction.user.id);

        const loader =
`getgenv().key = "${userKey}"
loadstring(game:HttpGet("${APP_URL}/hub?key=" .. getgenv().key))()`;

        return interaction.reply({
          content: "```lua\n" + loader + "\n```",
          ephemeral: true
        });
      }

      if (interaction.customId === "reset_hwid") {
        if (!hasRedeemed(interaction.user.id)) {
          return interaction.reply({ content: "Redeem a valid key first.", ephemeral: true });
        }

        const userKey = getUserKey(interaction.user.id);
        const resets = loadResets();
        const lastReset = resets[interaction.user.id];

        if (lastReset) {
          const remaining = getRemainingResetTime(lastReset);
          if (remaining) {
            return interaction.reply({
              content: `You can reset again in ${remaining}`,
              ephemeral: true
            });
          }
        }

        resets[interaction.user.id] = Date.now();
        saveResets(resets);

        const keys = loadKeys();
        keys[userKey].hwid = null;
        saveKeys(keys);

        return interaction.reply({
          content: "HWID reset successful.",
          ephemeral: true
        });
      }
    }

    // MODAL
    if (interaction.isModalSubmit() && interaction.customId === "redeem_modal") {
      const key = interaction.fields.getTextInputValue("key_input").trim();
      const keys = loadKeys();

      if (!keys[key]) {
        return interaction.reply({ content: "Invalid key.", ephemeral: true });
      }

      if (keys[key].usedBy && keys[key].usedBy !== interaction.user.id) {
        return interaction.reply({ content: "Key already used.", ephemeral: true });
      }

      keys[key].usedBy = interaction.user.id;
      keys[key].scriptAccess = true;
      keys[key].hwid = null;

      saveKeys(keys);

      const member = await interaction.guild.members.fetch(interaction.user.id);
      await member.roles.add(ROLE_ID);

      return interaction.reply({
        content: "Key redeemed + role given.",
        ephemeral: true
      });
    }

  } catch (err) {
    console.error(err);
  }
});

// =========================
// START
// =========================
registerCommands().then(() => client.login(TOKEN));
