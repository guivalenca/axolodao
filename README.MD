# GRUPO AXOBOTS APRESENTA: AMBYDATA

## Introdução

&emsp;O **AmbyData** é uma infraestrutura digital descentralizada voltada ao monitoramento, rastreabilidade e validação de dados científicos relacionados à conservação do gênero *Ambystoma*, com foco no axolote mexicano. O projeto busca resolver problemas estruturais como fragmentação de informações, baixa auditabilidade e dependência de validações centralizadas.

&emsp; A solução combina base de dados estruturada, smart contracts, identidade digital onchain e mecanismos de atestação verificável, garantindo integridade, transparência e continuidade histórica dos registros ambientais e biológicos.

&emsp; Ao integrar ciência ambiental e tecnologia blockchain, o AmbyData propõe um modelo de governança de dados mais confiável, auditável e replicável para iniciativas de conservação.

## Estrutura de pastas

&emsp; A atual estrutura de pastas do projeto AmbyData é composta pelos seguintes arquivos:

```
G02
 ┣ assets
 ┣ document
 ┣ frontend
 ┃ ┣ .angular
 ┃ ┣ .vscode
 ┃ ┣ node_modules
 ┃ ┣ public
 ┃ ┣ src
 ┃ ┃ ┣ app
 ┃ ┃ ┃ ┣ components
 ┃ ┃ ┃ ┃ ┣ tela-inicial
 ┃ ┃ ┃ ┃ ┣ monitoramento
 ┃ ┃ ┃ ┃ ┣ cadastro-tanque 
 ┃ ┃ ┃ ┃ ┣ cadastro-axolote
 ┃ ┃ ┃ ┃ ┣ login
 ┃ ┃ ┃ ┃ ┣ tanques
 ┃ ┃ ┃ ┃ ┗ axolotes 
 ┃ ┃ ┃ ┣ services
 ┃ ┃ ┃ ┃ ┗ web3.ts
 ┃ ┃ ┃ ┣ app.config.ts
 ┃ ┃ ┃ ┣ app.css
 ┃ ┃ ┃ ┣ app.html
 ┃ ┃ ┃ ┣ app.routes.ts
 ┃ ┃ ┃ ┣ app.spec.ts
 ┃ ┃ ┃ ┗ app.ts
 ┃ ┃ ┣ assets
 ┃ ┃ ┣ index.html
 ┃ ┃ ┣ main.ts
 ┃ ┃ ┗ styles.css
 ┃ ┣ .editorconfig
 ┃ ┣ .gitignore
 ┃ ┣ .prettierrc
 ┃ ┣ angular.json
 ┃ ┣ package-lock.json
 ┃ ┣ package.json
 ┃ ┣ tsconfig.app.json
 ┃ ┣ tsconfig.json
 ┃ ┗ tsconfig.spec.json
 ┣ smart_contract
 ┣ .gitignore
 ┣ dependencias.json
 ┣ package-lock.json
 ┗ package.json
 
 ``` 

 &emsp; Para a melhor compreensão sobre como a atual estrutura funciona, separamos os seguintes pontos:

 - ```frontend```: pasta principal do frontend que guarda toda a estrutura frontend.
 - ```components```: pasta que guarda todos os componentes (telas) do frontend do projeto, então estão armazenados lá os arquivos que permitem o bom funcionamento da tela de login, tela inicial, tela de monitoramento, tela de visualização de axolotes, tela de visualização de tanques cadastrado, tela de cadastro de axolote e tela de cadastro de tanque. Importante ressaltar também a tela de validação de registro que só é visível para os usuários auditores. 
 - ```services```: nesta pasta estão os arquivos que possibilitam a integração do frontend aos smart contracts criados.
- ```app.routes.ts```: é o arquivo que guarda todas as todas de navegação do site. 


