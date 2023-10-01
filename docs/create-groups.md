Bot nemoze vlastnit skupinu, ale vlastnictvo skupiny sa da transferovat z cloveka na cloveka.

Myslienka je, ze ked vytvorim skupinu, budem v nej na zaciatku len ja a bot.
Cize mi nechodia spoilery, lebo tam nikto nic nepise.
V momente ked niekto dalsi joinne skupinu (cez invite link), je potencial ze bude postovat spoilery,
takze bot na neho transferne ownership, a mna zo skupiny odstrani.

Presnejse by to bolo nejako takto:
 - Ked prvy clovek vyriesi zadanie, bot si to vsimne v AoC tabulke a vytvori skupinu.
   Vytvori ju ako Telegram user Matus Horvath (lebo bot nevie robit skupiny pod svojim Telegram uctom).
 - Bot (s Telegram uctom ako Matus Horvath) prida seba (Telegram usera @AocElfBot) do skupiny ako admina.
 - Potom bot pozve riesitelov do skupiny, rovnako ako teraz.
   To znamena ze posle riesitelom "invite" linky na ktore ludia este musia kliknut.
   Takze technicky prvy clovek pozvany do skupiny nemusi byt prvy clovek ktory ju joinne.
 - Ked prvy clovek (iny ako Matus Horvath) joinne skupinu, bot mu transferne ownership z mojho Telegram uctu na jeho.
   Takze prvy clovek v skupine bude ownovat skupinu.
   Potom ako Matus Horvath bot opusti skupinu (ak Matus Horvath este podla AoC tabulky nevyriesil zadanie).
 - Ked niekto dalsi joinne skupinu, bot z neho pripadne moze spravit admina ak sa tak dohodneme.
   Moze robit kazdeho adminom, alebo len ludi z vybraneho zoznamu.

Pripadne mozeme transferovat ownership len na ludi z nejakeho zoznamu. Potom by sa skupina vytvorila az ked zadanie vyriesi niekto kto ma dovolene byt ownerom skupiny.
