const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const adminNome = process.env.ADMIN_NOME || "Admin";
  const adminPin = process.env.ADMIN_PIN || "1234";

  const existingAdmin = await prisma.usuario.findUnique({
    where: { nome: adminNome },
    select: { id: true },
  });

  if (!existingAdmin) {
    const pinHash = await bcrypt.hash(adminPin, 10);
    await prisma.usuario.create({
      data: {
        nome: adminNome,
        pinHash,
        cargo: "ADMIN",
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

