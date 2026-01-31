import prisma from '@/lib/db'

async function main() {
  try {
    const result = await prisma.newsCard.deleteMany()
    console.log(`Deleted ${result.count} news cards`)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
