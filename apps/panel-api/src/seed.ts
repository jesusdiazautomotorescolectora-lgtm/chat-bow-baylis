import { prisma } from "./db.js";

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { id: "11b69e24-513a-4b18-86d3-d50a0eaf638b" },
    update: {},
    create: { id: "11b69e24-513a-4b18-86d3-d50a0eaf638b", name: "Demo Tenant" }
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "agent@demo.com" } },
    update: {},
    create: { tenantId: tenant.id, email: "agent@demo.com", name: "Demo Agent", role: "agent" }
  });

  const convo = await prisma.conversation.create({
    data: {
      tenantId: tenant.id,
      remoteJid: "5492494280874@s.whatsapp.net",
      status: "open"
    }
  });

  await prisma.message.createMany({
    data: [
      { tenantId: tenant.id, conversationId: convo.id, direction: "inbound", text: "Hola, precio?" },
      { tenantId: tenant.id, conversationId: convo.id, direction: "outbound", text: "Buenas! ¿Qué producto buscás?" }
    ]
  });

  console.log("Seed OK", { tenantId: tenant.id, conversationId: convo.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
