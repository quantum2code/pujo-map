ALTER TABLE "place" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "place" ADD COLUMN "location" geometry(point);