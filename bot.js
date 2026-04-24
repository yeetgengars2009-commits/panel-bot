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
  EmbedBuilder,
  PermissionFlagsBits
} = require("discord.js");

const { createClient } = require("@supabase/supabase-js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1496600113638932520";
const GUILD_ID = "1495883300978294968";
const ROLE_ID = "1495901658469765291";

const APP_URL = "https://panel-bot-production.up.railway.app";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

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
    return res.type("text/plain").send('print("Invalid key")');
  }

  if (!data.usedby) {
    return res.type("text/plain").send('print("Key not redeemed")');
  }

  if (data.scriptaccess === false) {
    return res.type("text/plain").send('print("No access")');
  }

  return res.type("text/plain").send(SCRIPT);
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Open user panel"),

  new SlashCommandBuilder()
    .setName("resethwid")
    .setDescription("Force reset a user's HWID")
    .addUserOption(opt =>
      opt.setName("user")
        .setDescription("User to reset")
        .setRequired(true)
    )
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands.map(cmd => cmd.toJSON()) }
  );

  console.log("Commands registered");
}

async function getUserKey(userId) {
  const { data } = await supabase
    .from("keys")
    .select("*")
    .eq("usedby", userId)
    .single();

  return data ? data.key : null;
}

async function hasRedeemed(userId) {
  const key = await getUserKey(userId);
  return !!key;
}

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "panel") {
        const panelEmbed = new EmbedBuilder()
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
          new ButtonBuilder()
            .setCustomId("redeem_key")
            .setLabel("Redeem Key")
            .setStyle(ButtonStyle.Primary),

          new ButtonBuilder()
            .setCustomId("get_script")
            .setLabel("Get Script")
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId("reset_hwid")
            .setLabel("Reset HWID")
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({
          embeds: [panelEmbed],
          components: [row],
        });
      }

      if (interaction.commandName === "resethwid") {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({
            content: "You don't have permission to use this.",
            ephemeral: true,
          });
        }

        const user = interaction.options.getUser("user");

        await supabase
          .from("keys")
          .update({ hwid: null })
          .eq("usedby", user.id);

        return interaction.reply({
          content: `HWID reset for ${user.tag}.`,
          ephemeral: true,
        });
      }
    }

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

        modal.addComponents(
          new ActionRowBuilder().addComponents(input)
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === "get_script") {
        const userKey = await getUserKey(interaction.user.id);

        if (!userKey) {
          return interaction.reply({
            content: "Redeem a valid key first.",
            ephemeral: true,
          });
        }

        const loader =
`getgenv().key = "${userKey}"
loadstring(game:HttpGet("${APP_URL}/hub?key=" .. getgenv().key))()`;

        return interaction.reply({
          content: "```lua\n" + loader + "\n```",
          ephemeral: true,
        });
      }

      if (interaction.customId === "reset_hwid") {
        const userKey = await getUserKey(interaction.user.id);

        if (!userKey) {
          return interaction.reply({
            content: "Redeem a valid key first.",
            ephemeral: true,
          });
        }

        await supabase
          .from("keys")
          .update({ hwid: null })
          .eq("key", userKey);

        return interaction.reply({
          content: "HWID reset successful.",
          ephemeral: true,
        });
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === "redeem_modal") {
        const enteredKey = interaction.fields.getTextInputValue("key_input").trim();

        const { data, error } = await supabase
          .from("keys")
          .select("*")
          .eq("key", enteredKey)
          .single();

        if (!data || error) {
          return interaction.reply({
            content: "Invalid key.",
            ephemeral: true,
          });
        }

        if (data.usedby && data.usedby !== interaction.user.id) {
          return interaction.reply({
            content: "That key is already used.",
            ephemeral: true,
          });
        }

        await supabase
          .from("keys")
          .update({
            usedby: interaction.user.id,
            scriptaccess: true,
            hwid: null,
            redeemedat: new Date().toISOString()
          })
          .eq("key", enteredKey);

        const member = await interaction.guild.members.fetch(interaction.user.id);
        await member.roles.add(ROLE_ID);

        return interaction.reply({
          content: "Key redeemed and role given.",
          ephemeral: true,
        });
      }
    }
  } catch (err) {
    console.error("INTERACTION ERROR:", err);

    if (interaction.isRepliable()) {
      return interaction.reply({
        content: "Something broke. Check Railway logs.",
        ephemeral: true,
      }).catch(() => {});
    }
  }
});

registerCommands()
  .then(() => client.login(TOKEN))
  .catch(console.error);
