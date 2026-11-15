-- Excluir item de estoque mantém as movimentações no histórico (sem o vínculo, com o nome do item)
ALTER TABLE "inventory_movements" ADD COLUMN "itemName" TEXT;
ALTER TABLE "inventory_movements" ALTER COLUMN "itemId" DROP NOT NULL;
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_itemId_fkey";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
