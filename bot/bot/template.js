const templateData = {
  title: "—",
  dateTime: "—",
  targetChannel: null,
  participantCount: 0,
  participants: []
};

function resetTemplate() {
  templateData.title = "—";
  templateData.dateTime = "—";
  templateData.targetChannel = null;
  templateData.participantCount = 0;
  templateData.participants = [];
}

module.exports = {
  templateData,
  resetTemplate
};
