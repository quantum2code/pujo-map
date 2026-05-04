CREATE TABLE "place" (
	"id" varchar(255) NOT NULL,
	"name" varchar(255),
	"cuisine" varchar(255),
	"opening_hrs" varchar,
	"properties" jsonb,
	CONSTRAINT "place_id_unique" UNIQUE("id")
);
