const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  UserSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  Events
} = require("discord.js");

const { getOptionsCollection } = require("../db/mongo");

module.exports = function setupInteractions(client, io) {

  let templateData = {
    title: "—",
    dateTime: "—",
    targetChannel: null,
    participantCount: 0,
    participants: []
  };

  client.on(Events.InteractionCreate, async interaction => {
    try {

      // ================== /auszahlung ==================
      if (interaction.isChatInputCommand() && interaction.commandName === "auszahlung") {
        const embed = new EmbedBuilder()
          .setTitle(templateData.title)
          .setAuthor({ name: templateData.dateTime })
          .setDescription("*Auszahlungen beim Leader abholen*");

        return interaction.reply({
          embeds: [embed],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("edit_info")
                .setLabel("📝 Titel / Datum")
                .setStyle(ButtonStyle.Primary)
            ),
            new ActionRowBuilder().addComponents(
              new ChannelSelectMenuBuilder()
                .setCustomId("select_channel")
                .setPlaceholder("📍 Ziel-Channel")
            ),
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("select_count")
                .setPlaceholder("👥 Teilnehmer")
                .addOptions([...Array(20).keys()].map(i => ({
                  label: `${i + 1} Teilnehmer`,
                  value: String(i + 1)
                })))
            )
          ]
        });
      }

      // ================== TITEL / DATUM ==================
      if (interaction.isButton() && interaction.customId === "edit_info") {
        const modal = new ModalBuilder()
          .setCustomId("info_modal")
          .setTitle("Event Infos")
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId("title").setLabel("Titel").setStyle(TextInputStyle.Short)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId("date").setLabel("Datum").setStyle(TextInputStyle.Short)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId("time").setLabel("Uhrzeit").setStyle(TextInputStyle.Short)
            )
          );

        return interaction.showModal(modal);
      }

      if (interaction.isModalSubmit() && interaction.customId === "info_modal") {
        templateData.title = interaction.fields.getTextInputValue("title");
        templateData.dateTime =
          `${interaction.fields.getTextInputValue("date")} – ${interaction.fields.getTextInputValue("time")}`;

        io.emit("templateUpdate", templateData);
        return interaction.reply({ content: "✅ Gespeichert", ephemeral: true });
      }

      // ================== CHANNEL ==================
      if (interaction.isChannelSelectMenu() && interaction.customId === "select_channel") {
        templateData.targetChannel = interaction.values[0];
        return interaction.reply({ content: "📍 Channel gesetzt", ephemeral: true });
      }

      // ================== TEILNEHMER ==================
      if (interaction.isStringSelectMenu() && interaction.customId === "select_count") {
        const count = Number(interaction.values[0]);
        const options = await getOptionsCollection().findOne({ _id: "default" });

        templateData.participantCount = count;
        templateData.participants = Array.from({ length: count }, () => ({
          user: null,
          amount: null,
          reason: null
        }));

        io.emit("templateUpdate", templateData);

        for (let i = 0; i < count; i++) {
          const actionRows = [
            new ActionRowBuilder().addComponents(
              new UserSelectMenuBuilder()
                .setCustomId(`user_${i}`)
                .setPlaceholder("Mitglied")
            ),
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId(`amount_${i}`)
                .setPlaceholder("Betrag")
                .addOptions([
                  ...options.amounts.map(a => ({ label: a, value: a })),
                  { label: "Custom", value: "custom_amount" }
                ])
            ),
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId(`reason_${i}`)
                .setPlaceholder("Grund")
                .addOptions([
                  ...options.reasons.map(r => ({ label: r, value: r })),
                  { label: "Custom", value: "custom_reason" }
                ])
            )
          ];

          // Fertig-Button nur beim letzten Teilnehmer
          if (i === count - 1) {
            actionRows.push(
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId("finish")
                  .setLabel("✅ Fertig")
                  .setStyle(ButtonStyle.Success)
              )
            );
          }

          if (i === 0) {
            await interaction.reply({ content: `Teilnehmer ${i + 1}`, components: actionRows, ephemeral: true });
          } else {
            await interaction.followUp({ content: `Teilnehmer ${i + 1}`, components: actionRows, ephemeral: true });
          }
        }
      }

      // ================== USER ==================
      if (interaction.isUserSelectMenu() && interaction.customId.startsWith("user_")) {
        const i = interaction.customId.split("_")[1];
        templateData.participants[i].user = `<@${interaction.values[0]}>`;
        io.emit("templateUpdate", templateData);
        return interaction.deferUpdate();
      }

      // ================== AMOUNT / REASON ==================
      if (interaction.isStringSelectMenu()) {
        const [type, i] = interaction.customId.split("_");
        if (!["amount", "reason"].includes(type)) return;

        const value = interaction.values[0];

        if (!value.startsWith("custom_")) {
          templateData.participants[i][type] = value;
          io.emit("templateUpdate", templateData);
          return interaction.deferUpdate();
        }

        const modal = new ModalBuilder()
          .setCustomId(`custom_${type}_modal_${i}`)
          .setTitle(`Custom ${type}`)
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId(type)
                .setLabel(type === "amount" ? "Betrag" : "Grund")
                .setStyle(type === "amount" ? TextInputStyle.Short : TextInputStyle.Paragraph)
            )
          );

        return interaction.showModal(modal);
      }

      // ================== CUSTOM MODAL ==================
      if (interaction.isModalSubmit() && interaction.customId.startsWith("custom_")) {
        const [, type, , i] = interaction.customId.split("_");
        templateData.participants[i][type] = interaction.fields.getTextInputValue(type);
        io.emit("templateUpdate", templateData);
        const { InteractionResponseFlags } = require("discord.js");
        return interaction.reply({ content: "✅ Gespeichert", flags: 64 });
      }

      // ================== FINISH ==================
      if (interaction.isButton() && interaction.customId === "finish") {
        const channel = interaction.guild.channels.cache.get(templateData.targetChannel);
        if (!channel) return interaction.reply({ content: "❌ Kein Channel", ephemeral: true });

        const text = templateData.participants
          .map(p => `• ${p.user} – ${p.amount} (${p.reason})`)
          .join("\n");

        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(templateData.title)
              .setAuthor({ name: templateData.dateTime })
              .setDescription(text)
          ]
        });

        templateData = { title: "—", dateTime: "—", targetChannel: null, participantCount: 0, participants: [] };
        io.emit("templateUpdate", templateData);
        return interaction.reply({ content: "✅ Gesendet", ephemeral: true });
      }

    } catch (err) {
      console.error(err);
    }
  });
};
