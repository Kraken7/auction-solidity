# Учебный проект Auction Engine - Hardhat Project

Данный проект разработан в учебных целях. Имеет полное покрытие тестами.

Данный аукион представляет из себя Голандский тип. Торги начинаются с максимальной цены, которая постепенно уменьшается. Тот кто покупает по текущей цене, сразу становится победителем.

Пользователь может создать аукцион на товар с определенной начальной ценой на указанный период времени. Также им устанавливается шаг уменьшения цены. Любой другой пользователь может купить товар за текущую стоимость. При этом аукцион возвращает переплату, а также берет комиссию, которую может вывести владелец смарт-контракта.

## Команды разработчика Hardhat Project

```shell
npx hardhat help
npx hardhat node
npx hardhat run scripts/deploy.js
npx hardhat test
npx hardhat coverage
```