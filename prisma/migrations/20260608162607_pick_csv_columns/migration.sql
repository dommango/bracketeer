/*
  Warnings:

  - Added the required column `section` to the `Pick` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Pick" ADD COLUMN     "section" TEXT NOT NULL;
