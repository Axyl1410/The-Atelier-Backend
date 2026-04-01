CREATE TABLE `comment` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`postId` text NOT NULL,
	`authorId` text NOT NULL,
	`parentId` text,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`postId`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parentId`,`postId`) REFERENCES `comment`(`id`,`postId`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `comment_id_postId_uidx` ON `comment` (`id`,`postId`);--> statement-breakpoint
CREATE INDEX `comment_postId_idx` ON `comment` (`postId`);--> statement-breakpoint
CREATE INDEX `comment_authorId_idx` ON `comment` (`authorId`);--> statement-breakpoint
CREATE INDEX `comment_parentId_idx` ON `comment` (`parentId`);--> statement-breakpoint
CREATE TABLE `post` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`summary` text,
	`coverImage` text,
	`isPublished` integer DEFAULT false NOT NULL,
	`authorId` text NOT NULL,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_slug_unique` ON `post` (`slug`);--> statement-breakpoint
CREATE INDEX `post_authorId_idx` ON `post` (`authorId`);--> statement-breakpoint
CREATE INDEX `post_slug_idx` ON `post` (`slug`);--> statement-breakpoint
CREATE INDEX `post_isPublished_createdAt_idx` ON `post` (`isPublished`,`createdAt`);--> statement-breakpoint
CREATE INDEX `post_authorId_createdAt_idx` ON `post` (`authorId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `post_tag` (
	`postId` text NOT NULL,
	`tagId` text NOT NULL,
	PRIMARY KEY(`postId`, `tagId`),
	FOREIGN KEY (`postId`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tagId`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_tag_tagId_idx` ON `post_tag` (`tagId`);--> statement-breakpoint
CREATE TABLE `tag` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_name_unique` ON `tag` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `tag_slug_unique` ON `tag` (`slug`);--> statement-breakpoint
CREATE TABLE `bookmark` (
	`userId` text NOT NULL,
	`postId` text NOT NULL,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`userId`, `postId`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`postId`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bookmark_postId_idx` ON `bookmark` (`postId`);--> statement-breakpoint
CREATE TABLE `follow` (
	`followerId` text NOT NULL,
	`followingId` text NOT NULL,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`followerId`, `followingId`),
	FOREIGN KEY (`followerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`followingId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "follow_no_self_follow_chk" CHECK("follow"."followerId" <> "follow"."followingId")
);
--> statement-breakpoint
CREATE INDEX `follow_followingId_idx` ON `follow` (`followingId`);--> statement-breakpoint
CREATE TABLE `post_like` (
	`userId` text NOT NULL,
	`postId` text NOT NULL,
	`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`userId`, `postId`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`postId`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_like_postId_idx` ON `post_like` (`postId`);