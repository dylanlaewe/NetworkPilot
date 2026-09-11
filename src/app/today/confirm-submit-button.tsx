"use client";
export function ConfirmSubmitButton({name,value,children,message,className}:{name?:string;value?:string;children:React.ReactNode;message:string;className?:string}){return <button type="submit" name={name} value={value} className={className} onClick={(event)=>{if(!window.confirm(message))event.preventDefault();}}>{children}</button>}
