ALTER TABLE fictional_company_profiles ADD COLUMN registry_alias_reviewed INTEGER NOT NULL DEFAULT 0 CHECK(registry_alias_reviewed IN (0,1));
