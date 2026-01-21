/*
eslint-disable
@typescript-eslint/no-explicit-any,no-use-before-define
*/

// Enums
import {
  Method,
} from './enums';

type $BaseConfig = {
  logging?: boolean;
  query?: {
    raw?: boolean;
  };
  timestamps?: boolean;
}

type $MysqlConfig = $BaseConfig & {
  database: string;
  dialect: 'mysql';
  host: string;
  password: string;
  port: string;
  username: string;
}

type $SqliteConfig = $BaseConfig & {
  dialect: 'sqlite';
  storage: string;
}

export type $Config = $MysqlConfig | $SqliteConfig;

type $IncludeInside<
MCC extends Record<MN, any>,
MCS extends Record<MN, any>,
MN extends keyof MCC,
> = MN | {
  as?: string;
  model: MCS[MN];
  where: $Where<MCC, MN>;
};

export type $Include<
MCC extends Record<MN, any>,
MCS extends Record<MN, any>,
MN extends keyof MCC,
> = Array<
$IncludeInside<MCC, MCS, MN> | string
>;

export type $QueryParams<
MCC extends Record<MN, any>,
MCS extends Record<MN, any>,
MN extends keyof MCC,
> = {
  // attributes?: Array<$Keys<$ModelQueryParams<M>>>,
  attributes?: Array<string>;
  // include?: $Include<$Keys<$ModelAssociations<M>>>,
  include?: $Include<MCC, MCS, any>;
  limit?: number;
  offset?: number;
  where?: $Where<MCC, MN>;
};

export type $RequestContext = {
  method: Method;
  request: Record<string, any>;
};

export type $Where<
MCC extends Record<MN, any>,
MN extends keyof MCC,
> = MCC[MN]['ModelQueryParams'] & {
  [key: string]: boolean | number | Record<string, unknown> | string | void;
};
