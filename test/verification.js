
var ScryptVerifier = artifacts.require('./scryptVerifier.sol');
var ScryptRunner = artifacts.require('./scryptRunner.sol');

var Web3 = require('web3');
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

contract('ScryptVerifier', function(accounts) {
    let scryptRunner, scryptVerifier;
    const steps = 2050;
    const claimDeposit = 1;

    beforeEach(async () => {
        scryptRunner = await ScryptRunner.new();
        scryptVerifier = await ScryptVerifier.new();
    })

    describe('Testing step values', () => {
        const account = accounts[0];

        const expectations = {
            0: [
                "0x3c268302673baaf8870141b9f4794454d2205c8f4074876a845d4df804bf55f",
                "0x62f06b94b13667ab93881eaeee5bdf4e803b452cc81928c314fe8160e1ecbb4f",
                "0xd97d406e33f717cad5950a7e6bdb7efbd171aa0dd30a1e448c33f791cf8c2016",
                "0x8e5bfa6d8e22bf3f240a4fc063e1f5b100728f046756d669cee62bb872154b45"
            ],
            1: [
                "0xafd217fb5feb256ef297b38bfaa3b6ab11bc21149568a18bf91dac87db4e7a83",
                "0x6458f3f41a9147b9abb7535fccca15de735fbc7b1bfeacfd3597600e12c08012",
                "0xc5a9f7db6589b26e8ab04ddd707892ceff0cf3e1ed5432b837540d6d1946952e",
                "0x396ffd44dfb9444c8adb64caffd9dd922d6542dae17db75ed82bf38bf3b91b78"
            ],
            1024: [
                "0x1c62770d44a4eeb47f01de7e65c8f43b026c637cf208dd6013a3f9df6e6ded0a",
                "0xe7b7ae5b8deaa9d9a147775886b0d31cfc7af04a27662405de9554aa06b1800b",
                "0x28c68c4b78f4b4fad370f4b662d9e7bc01fcecf2b6d9545714b909f272fe49b5",
                "0xc19f7ed077ec236a0721b6fe7abc9369ade9d7d7b60d22bbbe0baf8699c09472"
            ],
            1025: [
                "0xfaf12052158160f6a7255bc1689a6cc5bd8bc953ebddf8bbe645157d479119b9",
                "0xf5d793693d8f7c2840341db0abb693c2e562bae33883c731b1d9170436b2a5c1",
                "0xf92d1f40b7a4f75f121568fe96389755f8b689a05082e084cc8e6b70eb0ec1d3",
                "0x799d0314cfc8962dab57508b04f6d94e73b554c3d1a6bd0bb7c404fcc08b1133"
            ],
            2048: [
                "0x3f3d915849eba08428ac85aa72f9159d4a406afc43a598789d32110ff4d0bc40",
                "0x3959831424f3546318d09292760cc19bd6a7559f4bd603470c16c61b45398fa",
                "0x9e17c9061d1313a0a0998c7664d5588f13c9040cb4aa942702ff75c460e92145",
                "0x28b3b2ce855bea481cd966c078c062a715e2897e7c144e15c05dfd52e3bb7cdb"
            ]
        }

        // @TODO – fix this
        // currently gives "out of gas" error when when doing scryptRunner.run with i = 1024
        // potentially helpful links:
        // 1. https://ethereum.stackexchange.com/questions/9824/can-solidity-constant-functions-be-arbitrarily-complex/9827
        // 2. start testrpc with a higher limit: testrpc -l 4500000000000
        it("is correct.", async () => {
            // console.log("testing step values:".green)
            var input = '0x5858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858585858'
            for (var i of [0, 1, 1024, 1025, 2048]) {
                // console.log(i)
                // var result = await scryptRunner.run.call(input, i, {from: account})
                // console.log(result)
                // for (var j = 0; j < 4; j++) {
                //     let vars = result[1]
                //     if (expectations[i][j] != web3.toHex(vars[j])) {
                //         console.log(("Invalid internal state at step " + i).red)
                //         console.log(web3.toHex(vars[0]))
                //         console.log(web3.toHex(vars[1]))
                //         console.log(web3.toHex(vars[2]))
                //         console.log(web3.toHex(vars[3]))
                //         // error = true
                //     }
                // }

            }
            
            // result = await scryptRunner.run.call(input, 2049, {from: account})
            // if (result.output != "0xda26bdbab79be8f5162c4ca87cc52d6f926fb21461b9fb1c88bf19180cb5c246") {
            //     console.log("Invalid result after step 2049: ".red + result.output)
            //     anyError = true
            // }
        });
    });
});

