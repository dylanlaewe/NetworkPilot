import "server-only";
import type {ApolloBudgetRepository} from "./types";
import {ApolloAdapter} from "./adapter";
import {readApolloConfig} from "./config";
import {FetchApolloTransport} from "./http";

export function createServerApolloAdapter(repository:ApolloBudgetRepository,environment:Readonly<Record<string,string|undefined>>=process.env):ApolloAdapter{return new ApolloAdapter(readApolloConfig(environment),new FetchApolloTransport(),repository,{now:()=>new Date(),sleep:(milliseconds)=>new Promise((resolve)=>setTimeout(resolve,milliseconds)),datasetClassification:"authorized-provider",localDate:(date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(date)});}
