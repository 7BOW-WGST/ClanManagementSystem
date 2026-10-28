IF DB_ID('Baza7BOW') IS NULL EXECUTE('CREATE DATABASE [Baza7BOW];');
GO

USE [Baza7BOW];
GO

IF SCHEMA_ID('Schema_Baza7BOW') IS NULL EXECUTE('CREATE SCHEMA [Schema_Baza7BOW];');
GO

CREATE  TABLE members ( 
	id                   INT    AUTO_INCREMENT  NOT NULL,
	nickname             TEXT      NOT NULL,
	join_date            DATE      NOT NULL,
	CONSTRAINT pk_Entity PRIMARY KEY  ( id ) ,
	CONSTRAINT unq_members_nickname UNIQUE ( nickname ) 
 );
GO

CREATE  TABLE wt_accounts ( 
	id                   INT    AUTO_INCREMENT  NOT NULL,
	gaijin_id            INT      NULL,
	CONSTRAINT pk_wt_accounts PRIMARY KEY  ( id ) ,
	CONSTRAINT unq_wt_accounts_gaijin_id UNIQUE ( gaijin_id ) 
 );
GO

CREATE  TABLE wt_nicknames ( 
	id                   INT    AUTO_INCREMENT  NOT NULL,
	wt_account_id        INT      NOT NULL,
	wt_nickname          TEXT      NOT NULL,
	valid_from           DATE      NULL,
	valid_to             DATE      NULL,
	CONSTRAINT pk_wt_nicknames PRIMARY KEY  ( id ) 
 );
GO

CREATE  TABLE a3_profiles ( 
	id                   INT    AUTO_INCREMENT  NOT NULL,
	member_id            INT      NOT NULL,
	signup_nickname      TEXT      NOT NULL,
	a3u_nickname         TEXT      NOT NULL,
	CONSTRAINT pk_a3_profile PRIMARY KEY  ( id ) 
 );
GO

CREATE  TABLE discord_accounts ( 
	id                   INT    AUTO_INCREMENT  NOT NULL,
	member_id            INT      NOT NULL,
	discord_id           BIGINT      NOT NULL,
	valid_from           DATE      NULL,
	valid_to             DATE      NULL,
	is_main              BOOLEAN  CONSTRAINT DF_discord_accounts_is_main DEFAULT 1    NOT NULL,
	is_disabled          BOOLEAN  CONSTRAINT DF_discord_accounts_is_disabled DEFAULT 0    NOT NULL,
	notes                TEXT      NULL,
	CONSTRAINT pk_discord_accounts PRIMARY KEY  ( id ) ,
	CONSTRAINT unq_discord_accounts_discord_id UNIQUE ( discord_id ) 
 );
GO

CREATE  TABLE member_nickname_history ( 
	id                   INT    AUTO_INCREMENT  NOT NULL,
	member_id            INT      NOT NULL,
	nickname_old         TEXT      NOT NULL,
	valid_from           DATE      NULL,
	valid_to             DATE      NULL,
	CONSTRAINT pk_member_nickname_history PRIMARY KEY  ( id ) 
 );
GO

CREATE  TABLE wt_account_access ( 
	id                   INT    AUTO_INCREMENT  NOT NULL,
	member_id            INT      NOT NULL,
	wt_account_id        INT      NOT NULL,
	access_type          ENUM('main','alt','shared')  CONSTRAINT DF_wt_account_access_access_type DEFAULT main    NOT NULL,
	access_from          DATE      NULL,
	access_to            DATE      NULL,
	notes                TEXT      NULL,
	CONSTRAINT pk_wt_account_access PRIMARY KEY  ( id ) 
 );
GO

ALTER TABLE a3_profiles ADD CONSTRAINT fk_a3_profile_members FOREIGN KEY ( member_id ) REFERENCES members( id );
GO

ALTER TABLE discord_accounts ADD CONSTRAINT fk_discord_accounts_members FOREIGN KEY ( member_id ) REFERENCES members( id );
GO

ALTER TABLE member_nickname_history ADD CONSTRAINT fk_member_nickname_history FOREIGN KEY ( member_id ) REFERENCES members( id );
GO

ALTER TABLE wt_account_access ADD CONSTRAINT fk_wt_account_access_members FOREIGN KEY ( member_id ) REFERENCES members( id );
GO

ALTER TABLE wt_account_access ADD CONSTRAINT fk_wt_account_access FOREIGN KEY ( wt_account_id ) REFERENCES wt_accounts( id );
GO

ALTER TABLE wt_nicknames ADD CONSTRAINT fk_wt_nicknames_wt_accounts FOREIGN KEY ( wt_account_id ) REFERENCES wt_accounts( id );
GO

