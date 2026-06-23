 'use client';

import { createContext, useState, useEffect } from "react";

interface InterfaceData {
  id:number,
  titulo:string,
  descricao:string,
  valor:number
  tipo:string,
  target:number,
  color:string,
  disaster:number,
  disaster_color:string,
  value_ok:number
}

interface InterfaceNews {
  id:number
}

const ContextData = createContext<InterfaceData[]>([]);
const ContextNews = createContext<InterfaceNews[]>([]);

export default function Main() {

  const [cards, setCards] = useState<InterfaceData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(
        'http://127.0.0.1:3001/items'
      );

      setCards(await res.json());

    }

    fetchData();

  }, []);

  useEffect(() => {
    const fetchNews = async () => {
      const res = await fetch(
        'http://127.0.0.1:3001/news'
      );

      const resData = await res.json();
      const newsItems = await Promise.all(
        resData.map(async (item: { id: number }) => {
          const res = await fetch(
            `http://localhost:3001/items/?id=${item.id}`
          );
          const r = await res.json();
          return r[0];
        })
      );

      setCards(prev =>
        prev.map(item => newsItems.find(n => n.id === item.id) || item)
      );

      console.log(cards);
    }

    const interval = setInterval(fetchNews, 5*1000);

    return () => clearInterval(interval);
  },[cards]);

  return (
    <div>
      <ContextData.Provider value={cards} >
        <ContextNews.Provider value={[]} >
          <h1>Painel 1</h1>
          {cards.map(product => (
            <Card item={product} key={product.id} />
          ))}
        </ContextNews.Provider>
      </ContextData.Provider>
    </div>
  );
}

function Card(props:{item:InterfaceData}) {

  return (
    <div className="p-4 bg-blue-100 m-2 w-48">
      <p className="items-center w-full text-center">{props.item?.titulo}</p>
      <p className="items-center w-full text-center">{props.item?.descricao}</p>
      <p className="items-center w-full text-center">{props.item?.valor}</p>
      <p className="items-center w-full text-center">{props.item?.target}</p>
      <p className="items-center w-full text-center">{props.item?.disaster}</p>
      <p className="items-center w-full text-center">{props.item?.target / props.item?.disaster}</p>
      <p className="items-center w-full text-center">{props.item?.valor / props.item?.disaster}</p>
      <p className="items-center w-full text-center">{props.item?.value_ok}</p>
    </div>
  )
}