const express = require("express");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  Events
} = require("discord.js");

const { createClient } = require("@supabase/supabase-js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1496600113638932520";
const GUILD_ID = "1495883300978294968";

const APP_URL = "https://panel-bot-production.up.railway.app";

// SUPABASE
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// EXPRESS
const app = express();
const PORT = process.env.PORT || 3000;

let SCRIPT = `
print("Zawa loaded")
`;

app.get("/hub", async (req, res) => {
  const key = req.query.key;

  const { data, error } = await supabase
    .from("keys")
    .select("*")
    .eq("key", key)
    .single();

  if (!data || error) {
    return res.send('print("Invalid key")');
  }

  if (data.scriptaccess === false) {
    return res.send('print("No access")');
  }

  res.send(SCRIPT);
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

// DISCORD
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const commands = [
  new SlashCommandBuilder().setName("panel").setDescription("Open panel"),
  new SlashCommandBuilder()
    .setName("resethwid")
    .setDescription("Reset HWID")
    .addUserOption(opt =>
      opt.setName("user").setDescription("User").setRequired(true)
    )
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
  console.log("Commands registered");
}

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "panel") {
    return interaction.reply("Panel ready (buttons unchanged)");
  }

  if (interaction.commandName === "resethwid") {
    const user = interaction.options.getUser("user");

    await supabase
      .from("keys")
      .update({ hwid: null })
      .eq("usedby", user.id);

    return interaction.reply("HWID reset");
  }

});

// REDEEM SYSTEM
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isModalSubmit()) return;

  if (interaction.customId === "redeem_modal") {
    const key = interaction.fields.getTextInputValue("key_input");

    const { data } = await supabase
      .from("keys")
      .select("*")
      .eq("key", key)
      .single();

    if (!data) {
      return interaction.reply({ content: "Invalid key", ephemeral: true });
    }

    if (data.usedby) {
      return interaction.reply({ content: "Key already used", ephemeral: true });
    }

    await supabase
      .from("keys")
      .update({
        usedby: interaction.user.id,
        scriptaccess: true,
        hwid: null
      })
      .eq("key", key);

    return interaction.reply({ content: "Key redeemed", ephemeral: true });
  }
});

// START
registerCommands().then(() => client.login(TOKEN));
