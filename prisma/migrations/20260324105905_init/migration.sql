-- CreateEnum
CREATE TYPE "Role" AS ENUM ('HR', 'HIRING_MANAGER', 'APPROVER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ESCALATED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'HIRING_MANAGER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "HiringBrief" (
    "id" TEXT NOT NULL,
    "asanaTaskId" TEXT NOT NULL,
    "workableJobId" TEXT,
    "roleTitle" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "hiringManagerEmail" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL,
    "salaryRangeMin" INTEGER,
    "salaryRangeMax" INTEGER,
    "yearsExperience" INTEGER,
    "targetStartDate" TIMESTAMP(3),
    "roleSummary" TEXT,
    "hardSkills" TEXT,
    "softSkills" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approverName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "jdEnglish" TEXT,
    "jdFrench" TEXT,
    "jdGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiringBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateCache" (
    "id" TEXT NOT NULL,
    "workableCandidateId" TEXT NOT NULL,
    "workableJobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "currentStage" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL,
    "resumeUrl" TEXT,
    "linkedinUrl" TEXT,
    "aiVetScore" INTEGER,
    "aiVetStatus" TEXT,
    "aiVetSummary" TEXT,
    "aiVetQuestions" TEXT[],
    "aiVetRunAt" TIMESTAMP(3),
    "briefId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "HiringBrief_asanaTaskId_key" ON "HiringBrief"("asanaTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "HiringBrief_workableJobId_key" ON "HiringBrief"("workableJobId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateCache_workableCandidateId_key" ON "CandidateCache"("workableCandidateId");

-- CreateIndex
CREATE INDEX "CandidateCache_workableJobId_idx" ON "CandidateCache"("workableJobId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateCache" ADD CONSTRAINT "CandidateCache_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "HiringBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;
