const crypto = require("crypto");
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

const { createClient } = require("@supabase/supabase-js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1496600113638932520";
const GUILD_ID = "1495883300978294968";
const ROLE_ID = "1495901658469765291";
const KEY_MANAGER_ROLE_ID = "1495895086284804258";
const APP_URL = "https://panel-bot-production.up.railway.app";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

let SCRIPT = `
print("Zawa loaded")
`;

function hideKey(key) {
  if (!key || key.length < 9) return "Hidden";
  return key.slice(0, 4) + "-****-****-" + key.slice(-4);
}

function generateKey() {
  return crypto.randomBytes(8).toString("hex").toUpperCase().match(/.{1,4}/g).join("-");
}

async function getUserKeyRow(userId) {
  const { data } = await supabase.from("keys").select("*").eq("usedby", userId).maybeSingle();
  return data || null;
}

async function hasManagerRole(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  return member.roles.cache.has(KEY_MANAGER_ROLE_ID);
}

app.get("/hub", async (req, res) => {
  const key = req.query.key;

  const { data, error } = await supabase.from("keys").select("*").eq("key", key).maybeSingle();

  if (!data || error) return res.type("text/plain").send('print("Invalid key")');
  if (!data.usedby) return res.type("text/plain").send('print("Key not redeemed")');
  if (data.scriptaccess === false || data.banned === true) return res.type("text/plain").send('print("No access")');

  await supabase
    .from("keys")
    .update({
      totalexecutions: (data.totalexecutions || 0) + 1,
      lastexecution: new Date().toISOString()
    })
    .eq("key", key);

  return res.type("text/plain").send(SCRIPT);
});

app.listen(PORT, () => console.log("Server running on port " + PORT));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder().setName("panel").setDescription("Open user panel"),

  new SlashCommandBuilder()
    .setName("genkey")
    .setDescription("Generate keys")
    .addIntegerOption(opt => opt.setName("amount").setDescription("Amount").setRequired(true).setMinValue(1).setMaxValue(50)),

  new SlashCommandBuilder()
    .setName("resethwid")
    .setDescription("Force reset a user's HWID")
    .addUserOption(opt => opt.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("keyinfo")
    .setDescription("Check key info")
    .addStringOption(opt => opt.setName("key").setDescription("Key").setRequired(true)),

  new SlashCommandBuilder()
    .setName("userkeys")
    .setDescription("Show user keys")
    .addUserOption(opt => opt.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("blacklist")
    .setDescription("Blacklist a user")
    .addUserOption(opt => opt.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unblacklist")
    .setDescription("Unblacklist a key")
    .addStringOption(opt => opt.setName("key").setDescription("Key").setRequired(true)),

  new SlashCommandBuilder()
    .setName("resetkey")
    .setDescription("Reset a key")
    .addStringOption(opt => opt.setName("key").setDescription("Key").setRequired(true)),

  new SlashCommandBuilder()
    .setName("deletekey")
    .setDescription("Delete a key")
    .addStringOption(opt => opt.setName("key").setDescription("Key").setRequired(true))
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands.map(cmd => cmd.toJSON())
  });
  console.log("Commands registered");
}

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName !== "panel" && !(await hasManagerRole(interaction))) {
        return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
      }

      if (interaction.commandName === "panel") {
        const panelEmbed = new EmbedBuilder()
          .setColor(0x2f6df6)
          .setTitle("User Panel")
          .setDescription([
            "Welcome! Use the buttons below to manage your key.",
            "",
            "Redeem Key - Link a key to your Discord account.",
            "Get Script - Get the script with your key.",
            "Reset HWID - Reset your locked HWID.",
            "Stats - View your key stats."
          ].join("\n"));

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("redeem_key").setLabel("Redeem Key").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("get_script").setLabel("Get Script").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("reset_hwid").setLabel("Reset HWID").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("stats").setLabel("Stats").setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({ embeds: [panelEmbed], components: [row] });
      }

      if (interaction.commandName === "genkey") {
        const amount = interaction.options.getInteger("amount");
        const rows = [];

        for (let i = 0; i < amount; i++) {
          rows.push({
            key: generateKey(),
            usedby: null,
            hwid: null,
            scriptaccess: true,
            banned: false,
            totalexecutions: 0,
            totalhwidresets: 0,
            note: null
          });
        }

        const { error } = await supabase.from("keys").insert(rows);
        if (error) return interaction.reply({ content: "Failed to generate keys. Check Railway logs.", ephemeral: true });

        return interaction.reply({
          content: `Generated ${amount} key(s):\n\`\`\`\n${rows.map(r => r.key).join("\n")}\n\`\`\``,
          ephemeral: true
        });
      }

      if (interaction.commandName === "resethwid") {
        const user = interaction.options.getUser("user");
        const row = await getUserKeyRow(user.id);

        if (!row) return interaction.reply({ content: "That user has no redeemed key.", ephemeral: true });

        await supabase.from("keys").update({
          hwid: null,
          totalhwidresets: (row.totalhwidresets || 0) + 1,
          lastreset: new Date().toISOString()
        }).eq("usedby", user.id);

        return interaction.reply({ content: `HWID reset for ${user.tag}.`, ephemeral: true });
      }

      if (interaction.commandName === "keyinfo") {
        const key = interaction.options.getString("key");
        const { data } = await supabase.from("keys").select("*").eq("key", key).maybeSingle();

        if (!data) return interaction.reply({ content: "Key not found.", ephemeral: true });

        return interaction.reply({
          content:
`**Key Info**
Key: \`${data.key}\`
Used By: ${data.usedby || "None"}
HWID: ${data.hwid || "None"}
Script Access: ${data.scriptaccess}
Banned: ${data.banned ? "Yes" : "No"}
Executions: ${data.totalexecutions || 0}
HWID Resets: ${data.totalhwidresets || 0}
Last Reset: ${data.lastreset || "Never"}
Last Execution: ${data.lastexecution || "Never"}
Expires At: ${data.expiresat || "Never"}
Note: ${data.note || "Not specified"}`,
          ephemeral: true
        });
      }

      if (interaction.commandName === "userkeys") {
        const user = interaction.options.getUser("user");
        const { data } = await supabase.from("keys").select("*").eq("usedby", user.id);

        if (!data || data.length === 0) return interaction.reply({ content: "No keys found for that user.", ephemeral: true });

        return interaction.reply({
          content: `Keys for ${user.tag}:\n\`\`\`\n${data.map(k => k.key).join("\n")}\n\`\`\``,
          ephemeral: true
        });
      }

      if (interaction.commandName === "blacklist") {
        const user = interaction.options.getUser("user");
        const row = await getUserKeyRow(user.id);

        if (!row) return interaction.reply({ content: "That user has no redeemed key.", ephemeral: true });

        await supabase.from("keys").update({
          usedby: null,
          hwid: null,
          scriptaccess: false,
          banned: true,
          note: `Blacklisted user ${user.tag} (${user.id})`
        }).eq("usedby", user.id);

        return interaction.reply({ content: `${user.tag} has been blacklisted and their key was reset.`, ephemeral: true });
      }

      if (interaction.commandName === "unblacklist") {
        const key = interaction.options.getString("key");

        await supabase.from("keys").update({
          scriptaccess: true,
          banned: false
        }).eq("key", key);

        return interaction.reply({ content: "Key unblacklisted.", ephemeral: true });
      }

      if (interaction.commandName === "resetkey") {
        const key = interaction.options.getString("key");

        await supabase.from("keys").update({
          usedby: null,
          hwid: null
        }).eq("key", key);

        return interaction.reply({ content: "Key reset.", ephemeral: true });
      }

      if (interaction.commandName === "deletekey") {
        const key = interaction.options.getString("key");

        await supabase.from("keys").delete().eq("key", key);

        return interaction.reply({ content: "Key deleted.", ephemeral: true });
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === "redeem_key") {
        const modal = new ModalBuilder().setCustomId("redeem_modal").setTitle("Redeem Key");

        const input = new TextInputBuilder()
          .setCustomId("key_input")
          .setLabel("Enter your key")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (interaction.customId === "get_script") {
        const row = await getUserKeyRow(interaction.user.id);

        if (!row) return interaction.reply({ content: "Redeem a valid key first.", ephemeral: true });
        if (row.scriptaccess === false || row.banned) return interaction.reply({ content: "No access.", ephemeral: true });

        const loader =
`getgenv().key = "${row.key}"
loadstring(game:HttpGet("${APP_URL}/hub?key=" .. getgenv().key))()`;

        return interaction.reply({ content: "```lua\n" + loader + "\n```", ephemeral: true });
      }

      if (interaction.customId === "reset_hwid") {
        const row = await getUserKeyRow(interaction.user.id);

        if (!row) return interaction.reply({ content: "Redeem a valid key first.", ephemeral: true });

        await supabase.from("keys").update({
          hwid: null,
          totalhwidresets: (row.totalhwidresets || 0) + 1,
          lastreset: new Date().toISOString()
        }).eq("key", row.key);

        return interaction.reply({ content: "HWID reset successful.", ephemeral: true });
      }

      if (interaction.customId === "stats") {
        const row = await getUserKeyRow(interaction.user.id);

        if (!row) return interaction.reply({ content: "Redeem a valid key first.", ephemeral: true });

        const stats =
`**Stats**
Total Executions: ${row.totalexecutions || 0} 🧠
HWID Status: ${row.hwid ? "Assigned ✅" : "Not Assigned ❌"}
Key: ${hideKey(row.key)} 🔒
Total HWID Resets: ${row.totalhwidresets || 0} ⚙️
Last Reset: ${row.lastreset || "Never"} 📅
Expires At: ${row.expiresat || "Never"} 📅
Banned: ${row.banned ? "Yes ⛔" : "No ⛔"}

**Note:**
${row.note || "Not specified"}`;

        return interaction.reply({ content: stats, ephemeral: true });
      }
    }

    if (interaction.isModalSubmit() && interaction.customId === "redeem_modal") {
      const enteredKey = interaction.fields.getTextInputValue("key_input").trim();

      const { data } = await supabase.from("keys").select("*").eq("key", enteredKey).maybeSingle();

      if (!data) return interaction.reply({ content: "Invalid key.", ephemeral: true });
      if (data.banned || data.scriptaccess === false) return interaction.reply({ content: "This key has no access.", ephemeral: true });
      if (data.usedby && data.usedby !== interaction.user.id) return interaction.reply({ content: "That key is already used.", ephemeral: true });

      await supabase.from("keys").update({
        usedby: interaction.user.id,
        scriptaccess: true,
        hwid: null,
        redeemedat: new Date().toISOString()
      }).eq("key", enteredKey);

      const member = await interaction.guild.members.fetch(interaction.user.id);
      await member.roles.add(ROLE_ID);

      return interaction.reply({ content: "Key redeemed and role given.", ephemeral: true });
    }
  } catch (err) {
    console.error("INTERACTION ERROR:", err);
    if (interaction.isRepliable()) {
      return interaction.reply({ content: "Something broke. Check Railway logs.", ephemeral: true }).catch(() => {});
    }
  }
});

registerCommands().then(() => client.login(TOKEN)).catch(console.error);
