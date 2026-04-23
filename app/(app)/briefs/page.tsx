import { prisma } from "@/lib/utils/prisma"
import Link from "next/link"
import { ApprovalBadge } from "@/components/brief/ApprovalBadge"
import { ArchiveBriefButton } from "./ArchiveBriefButton"
import { HiringBrief } from "@prisma/client"
import {
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@levelinteractive/ui"

export default async function BriefsListPage() {
  const briefs = await prisma.hiringBrief.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-heading font-semibold text-foreground">Hiring briefs</h1>
        <Button asChild>
          <Link href="/briefs/new">New brief</Link>
        </Button>
      </div>

      {briefs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground text-sm">No briefs yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Hiring manager</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {briefs.map((brief: HiringBrief) => (
                <TableRow key={brief.id}>
                  <TableCell>
                    <Link href={`/briefs/${brief.id}`} className="font-medium text-foreground hover:underline">
                      {brief.roleTitle}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{brief.department}</TableCell>
                  <TableCell className="text-muted-foreground">{brief.hiringManagerEmail}</TableCell>
                  <TableCell>
                    <ApprovalBadge status={brief.approvalStatus} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(brief.createdAt).toLocaleDateString("en-CA")}
                  </TableCell>
                  <TableCell className="text-right">
                    <ArchiveBriefButton briefId={brief.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
