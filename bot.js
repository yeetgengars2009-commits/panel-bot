const fs = require("fs");
const crypto = require("crypto");
const express = require("express");

const {
  Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, SlashCommandBuilder,
  REST, Routes, Events, EmbedBuilder
} = require("discord.js");

const { createClient } = require("@supabase/supabase-js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1496600113638932520";
const GUILD_ID = "1495883300978294968";
const ROLE_ID = "1495901658469765291";

const OWNER_ID = "414948849019256835";

const FULL_ROLE = "1495895086284804258";
const MID_ROLE = "1495887512739250196";
const LOW_ROLE = "1495905337104924782";

const APP_URL = "https://panel-bot-production.up.railway.app";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

let SCRIPT = fs.readFileSync("./script.lua", "utf8");

function zawaEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0x2f6df6)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "Zawa Helper" });
}

function generateKey() {
  return crypto.randomBytes(8).toString("hex").toUpperCase().match(/.{1,4}/g).join("-");
}

function getExpiryDate(length, unit) {
  const now = new Date();

  if (unit === "minutes") now.setMinutes(now.getMinutes() + length);
  if (unit === "hours") now.setHours(now.getHours() + length);
  if (unit === "days") now.setDate(now.getDate() + length);

  return now.toISOString();
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

async function getUserKeyRow(userId) {
  const { data } = await supabase
    .from("keys")
    .select("*")
    .eq("usedby", userId)
    .maybeSingle();

  return data || null;
}

async function getRoleAccess(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);

  return {
    isOwner: interaction.user.id === OWNER_ID,
    hasFull: member.roles.cache.has(FULL_ROLE),
    hasMid: member.roles.cache.has(MID_ROLE),
    hasLow: member.roles.cache.has(LOW_ROLE)
  };
}

app.get("/hub", async (req, res) => {
  const key = req.query.key;

  const { data, error } = await supabase
    .from("keys")
    .select("*")
    .eq("key", key)
    .maybeSingle();

  if (!data || error) return res.type("text/plain").send('print("Invalid key")');
  if (!data.usedby) return res.type("text/plain").send('print("Key not redeemed")');
  if (data.scriptaccess === false || data.banned === true) return res.type("text/plain").send('print("No access")');
  if (isExpired(data.expiresat)) return res.type("text/plain").send('print("Key expired")');

  await supabase.from("keys").update({
    totalexecutions: (data.totalexecutions || 0) + 1,
    lastexecution: new Date().toISOString()
  }).eq("key", key);

  return res.type("text/plain").send(SCRIPT);
});

app.listen(PORT, () => console.log("Server running on port " + PORT));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder().setName("panel").setDescription("Open user panel"),
  new SlashCommandBuilder().setName("zawahelp").setDescription("Help menu"),

  new SlashCommandBuilder()
    .setName("genkey")
    .setDescription("Generate keys")
    .addIntegerOption(opt =>
      opt.setName("amount").setDescription("Amount").setRequired(true).setMinValue(1).setMaxValue(50)
    ),

  new SlashCommandBuilder()
    .setName("gentimekey")
    .setDescription("Generate 1 timed key")
    .addIntegerOption(opt =>
      opt.setName("length").setDescription("How long the key lasts").setRequired(true).setMinValue(1)
    )
    .addStringOption(opt =>
      opt.setName("unit")
        .setDescription("Time unit")
        .setRequired(true)
        .addChoices(
          { name: "minutes", value: "minutes" },
          { name: "hours", value: "hours" },
          { name: "days", value: "days" }
        )
    ),

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
    .setDescription("Unblacklist a user")
    .addUserOption(opt => opt.setName("user").setDescription("User").setRequired(true)),

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
      const cmd = interaction.commandName;
      const access = await getRoleAccess(interaction);

      if (cmd !== "panel") {
        if (access.isOwner) {
        } else if (cmd === "gentimekey") {
          return interaction.reply({ embeds: [zawaEmbed("No Permission", "Only the owner can use this command.")], ephemeral: true });
        } else if (access.hasFull) {
        } else if (access.hasMid) {
          const allowed = ["zawahelp", "resethwid", "keyinfo", "userkeys"];
          if (!allowed.includes(cmd)) {
            return interaction.reply({ embeds: [zawaEmbed("No Permission", "Not allowed.")], ephemeral: true });
          }
        } else if (access.hasLow) {
          if (cmd !== "keyinfo") {
            return interaction.reply({ embeds: [zawaEmbed("No Permission", "Only /keyinfo allowed.")], ephemeral: true });
          }
        } else {
          return interaction.reply({ embeds: [zawaEmbed("No Permission", "No access.")], ephemeral: true });
        }
      }

      if (cmd === "zawahelp") {
        return interaction.reply({
          embeds: [zawaEmbed("Commands", [
            "`/panel`",
            "`/zawahelp`",
            "`/genkey`",
            "`/gentimekey` - owner only timed key",
            "`/resethwid`",
            "`/keyinfo`",
            "`/userkeys`",
            "`/blacklist`",
            "`/unblacklist`",
            "`/resetkey`",
            "`/deletekey`"
          ].join("\n"))]
        });
      }

      if (cmd === "panel") {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("redeem_key").setLabel("Redeem Key").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("get_script").setLabel("Get Script").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("reset_hwid").setLabel("Reset HWID").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("stats").setLabel("Stats").setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({
          embeds: [zawaEmbed("User Panel", "Welcome! Use the buttons below to manage your key.")],
          components: [row]
        });
      }

      if (cmd === "genkey") {
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
            note: null,
            expiresat: null
          });
        }

        const { error } = await supabase.from("keys").insert(rows);

        if (error) return interaction.reply({ embeds: [zawaEmbed("Error", "Failed to generate keys. Check Railway logs.")] });

        return interaction.reply({
          embeds: [zawaEmbed("Generated Keys", `Generated ${amount} key(s):\n\`\`\`\n${rows.map(r => r.key).join("\n")}\n\`\`\``)]
        });
      }

      if (cmd === "gentimekey") {
        const length = interaction.options.getInteger("length");
        const unit = interaction.options.getString("unit");
        const key = generateKey();
        const expiresAt = getExpiryDate(length, unit);

        const { error } = await supabase.from("keys").insert([{
          key,
          usedby: null,
          hwid: null,
          scriptaccess: true,
          banned: false,
          totalexecutions: 0,
          totalhwidresets: 0,
          note: `Timed key: ${length} ${unit}`,
          expiresat: expiresAt
        }]);

        if (error) return interaction.reply({ embeds: [zawaEmbed("Error", "Failed to generate timed key.")] });

        return interaction.reply({
          embeds: [zawaEmbed("Timed Key Generated", [
            `Key: \`${key}\``,
            `Valid For: ${length} ${unit}`,
            `Expires At: ${expiresAt}`
          ].join("\n"))]
        });
      }

      if (cmd === "resethwid") {
        const user = interaction.options.getUser("user");
        const row = await getUserKeyRow(user.id);

        if (!row) return interaction.reply({ embeds: [zawaEmbed("Not Found", "That user has no redeemed key.")] });

        await supabase.from("keys").update({
          hwid: null,
          totalhwidresets: (row.totalhwidresets || 0) + 1,
          lastreset: new Date().toISOString()
        }).eq("usedby", user.id);

        return interaction.reply({ embeds: [zawaEmbed("HWID Reset", `HWID reset for ${user.tag}.`)] });
      }

      if (cmd === "keyinfo") {
        const key = interaction.options.getString("key");
        const { data } = await supabase.from("keys").select("*").eq("key", key).maybeSingle();

        if (!data) return interaction.reply({ embeds: [zawaEmbed("Not Found", "Key not found.")] });

        return interaction.reply({
          embeds: [zawaEmbed("Key Info", [
            `Key: \`${data.key}\``,
            `Used By: ${data.usedby || "None"}`,
            `HWID: ${data.hwid || "None"}`,
            `Script Access: ${data.scriptaccess}`,
            `Banned: ${data.banned ? "Yes" : "No"}`,
            `Executions: ${data.totalexecutions || 0}`,
            `HWID Resets: ${data.totalhwidresets || 0}`,
            `Last Reset: ${data.lastreset || "Never"}`,
            `Last Execution: ${data.lastexecution || "Never"}`,
            `Expires At: ${data.expiresat || "Never"}`,
            `Expired: ${isExpired(data.expiresat) ? "Yes" : "No"}`,
            `Note: ${data.note || "Not specified"}`
          ].join("\n"))]
        });
      }

      if (cmd === "userkeys") {
        const user = interaction.options.getUser("user");
        const { data } = await supabase.from("keys").select("*").eq("usedby", user.id);

        if (!data || data.length === 0) return interaction.reply({ embeds: [zawaEmbed("No Keys", "No keys found for that user.")] });

        return interaction.reply({
          embeds: [zawaEmbed(`Keys for ${user.tag}`, `\`\`\`\n${data.map(k => k.key).join("\n")}\n\`\`\``)]
        });
      }

      if (cmd === "blacklist") {
        const user = interaction.options.getUser("user");
        const row = await getUserKeyRow(user.id);

        if (!row) return interaction.reply({ embeds: [zawaEmbed("Not Found", "That user has no redeemed key.")] });

        await supabase.from("keys").update({
          usedby: null,
          hwid: null,
          scriptaccess: false,
          banned: true,
          note: `Blacklisted user ${user.tag} (${user.id})`
        }).eq("key", row.key);

        return interaction.reply({ embeds: [zawaEmbed("User Blacklisted", `${user.tag} has been blacklisted and their key was reset.`)] });
      }

      if (cmd === "unblacklist") {
        const user = interaction.options.getUser("user");

        const { data } = await supabase
          .from("keys")
          .select("*")
          .ilike("note", `%${user.id}%`)
          .maybeSingle();

        if (!data) return interaction.reply({ embeds: [zawaEmbed("Not Found", "No blacklisted key found for that user.")] });

        await supabase.from("keys").update({
          scriptaccess: true,
          banned: false,
          note: null
        }).eq("key", data.key);

        return interaction.reply({ embeds: [zawaEmbed("User Unblacklisted", `${user.tag} has been unblacklisted.`)] });
      }

      if (cmd === "resetkey") {
        const key = interaction.options.getString("key");

        await supabase.from("keys").update({
          usedby: null,
          hwid: null
        }).eq("key", key);

        return interaction.reply({ embeds: [zawaEmbed("Key Reset", "Key ownership and HWID have been reset.")] });
      }

      if (cmd === "deletekey") {
        const key = interaction.options.getString("key");

        await supabase.from("keys").delete().eq("key", key);

        return interaction.reply({ embeds: [zawaEmbed("Key Deleted", "Key deleted from database.")] });
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

        if (!row) return interaction.reply({ embeds: [zawaEmbed("No Key", "Redeem a valid key first.")], ephemeral: true });
        if (row.scriptaccess === false || row.banned || isExpired(row.expiresat)) {
          return interaction.reply({ embeds: [zawaEmbed("No Access", "Your key does not have access or has expired.")], ephemeral: true });
        }

        const loader =
`getgenv().key = "${row.key}"
loadstring(game:HttpGet("${APP_URL}/hub?key=" .. getgenv().key))()`;

        return interaction.reply({ embeds: [zawaEmbed("Your Loader", `\`\`\`lua\n${loader}\n\`\`\``)], ephemeral: true });
      }

      if (interaction.customId === "reset_hwid") {
        const row = await getUserKeyRow(interaction.user.id);

        if (!row) return interaction.reply({ embeds: [zawaEmbed("No Key", "Redeem a valid key first.")], ephemeral: true });

        await supabase.from("keys").update({
          hwid: null,
          totalhwidresets: (row.totalhwidresets || 0) + 1,
          lastreset: new Date().toISOString()
        }).eq("key", row.key);

        return interaction.reply({ embeds: [zawaEmbed("HWID Reset", "HWID reset successful.")], ephemeral: true });
      }

      if (interaction.customId === "stats") {
        const row = await getUserKeyRow(interaction.user.id);

        if (!row) return interaction.reply({ embeds: [zawaEmbed("No Key", "Redeem a valid key first.")], ephemeral: true });

        const stats = [
          `Total Executions: ${row.totalexecutions || 0} 🧠`,
          `HWID Status: ${row.hwid ? "Assigned ✅" : "Not Assigned ❌"}`,
          `Key: ||${row.key}|| 🔒`,
          `Total HWID Resets: ${row.totalhwidresets || 0} ⚙️`,
          `Last Reset: ${row.lastreset || "Never"} 📅`,
          `Expires At: ${row.expiresat || "Never"} 📅`,
          `Expired: ${isExpired(row.expiresat) ? "Yes" : "No"}`,
          `Banned: ${row.banned ? "Yes ⛔" : "No ⛔"}`,
          "",
          `**Note:**`,
          `${row.note || "Not specified"}`
        ].join("\n");

        return interaction.reply({ embeds: [zawaEmbed("Stats", stats)], ephemeral: true });
      }
    }

    if (interaction.isModalSubmit() && interaction.customId === "redeem_modal") {
      const enteredKey = interaction.fields.getTextInputValue("key_input").trim();

      const { data } = await supabase.from("keys").select("*").eq("key", enteredKey).maybeSingle();

      if (!data) return interaction.reply({ embeds: [zawaEmbed("Invalid Key", "That key does not exist.")], ephemeral: true });
      if (data.banned || data.scriptaccess === false) return interaction.reply({ embeds: [zawaEmbed("No Access", "This key has no access.")], ephemeral: true });
      if (isExpired(data.expiresat)) return interaction.reply({ embeds: [zawaEmbed("Expired Key", "This key has expired.")], ephemeral: true });
      if (data.usedby && data.usedby !== interaction.user.id) return interaction.reply({ embeds: [zawaEmbed("Already Used", "That key is already used.")], ephemeral: true });

      await supabase.from("keys").update({
        usedby: interaction.user.id,
        scriptaccess: true,
        hwid: null,
        redeemedat: new Date().toISOString()
      }).eq("key", enteredKey);

      const member = await interaction.guild.members.fetch(interaction.user.id);
      await member.roles.add(ROLE_ID);

      return interaction.reply({ embeds: [zawaEmbed("Key Redeemed", "Key redeemed and role given.")], ephemeral: true });
    }
  } catch (err) {
    console.error("INTERACTION ERROR:", err);
    if (interaction.isRepliable()) {
      return interaction.reply({ embeds: [zawaEmbed("Error", "Something broke. Check Railway logs.")], ephemeral: true }).catch(() => {});
    }
  }
});

registerCommands().then(() => client.login(TOKEN)).catch(console.error);
