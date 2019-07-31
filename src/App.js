import React from 'react';
import './App.css';
import LedgerUSB from './LedgerUSB';
import algosdk_address from 'algosdk/src/encoding/address';

export default class App extends React.Component {
	constructor (props) {
		super(props);

		this.ledgerUSB = new LedgerUSB();

		this.state = {
			address: '',
			signedTx: '',
			error: ''
		}

		this.allowUsbAccess = this.allowUsbAccess.bind(this);
		this.getAddress = this.getAddress.bind(this);
		this.signSampleTx = this.signSampleTx.bind(this);
	}

	async allowUsbAccess(e) {
		this.ledgerUSB.allowAccess();
	}

	async getAddress(e) {
		e.preventDefault();

		try {
			let address = await this.ledgerUSB.getAddress();
			this.setState({
				address,
				signedTx: '',
				error: ''
			});
		}
		catch (err) {
			this.setState({
				address: '',
				signedTx: '',
				error: err.stack ? err.stack.toString() : err.toString()
			});
		}
	}

	async signSampleTx(e) {
		e.preventDefault();

		try {
			let tx = await this.ledgerUSB.signTransaction({
				txn: {
					type: 'pay',
					snd: algosdk_address.decode('QQ2Q4MDDM2F7SMWWQRLOOPFL4ZKLUXM2MW2VLYXX4VHRB6D3R7M65USKHQ').publicKey,
					fee: 1000,
					fv: 3150,
					lv: 3250,
					rcv: algosdk_address.decode('MN3CIWJHPDMLYZ7RU2ZUBPJUE7SUIQYNI4DBGDC2XUZZEJ566LNIUBM2XI').publicKey,
					amt: 10000,
					note: Buffer.alloc(0),
					gen: 'mainnet-v1.0',
					gh: Buffer.from('wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=', 'base64')
				}
			});
			this.setState({
				address: '',
				signedTx: JSON.stringify(tx),
				error: ''
			});
		}
		catch (err) {
			this.setState({
				address: '',
				signedTx: '',
				error: err.stack ? err.stack.toString() : err.toString()
			});
		}
	}


	render() {
		const isSupported = LedgerUSB.isSupported();
		const preBlockCSS = {
			overflow: 'auto',
			fontFamily: 'Monaco, monospace',
			fontSize: '1rem',
			padding: '10px',
			color: '#000',
			backgroundColor: '#fff',
		  };

		return (
			<div className="App">
				<header className="App-header">
					{isSupported ? (
						<div style={{ width: '90%' }}>
							<p>WebUSB is supported</p>
							<p>
								<button onClick={this.getAddress}>Get Address</button>
								&nbsp;&nbsp;&nbsp;
								<button onClick={this.signSampleTx}>Sign sample transaction</button>
							</p>
							<hr />
							{
								(
									this.state.address.length > 0 &&
									<p>Address is: {this.state.address}</p>
								)
							}
							{
								(
									this.state.signedTx.length > 0 &&
									<div>
										Signed TX:<br />
										<pre style={preBlockCSS}>{this.state.signedTx}</pre>
									</div>
								)
							}
							{
								(
									this.state.error.length > 0 &&
									<div>
										Error:<br />
										<pre style={preBlockCSS}>{this.state.error}</pre>
									</div>
								)
							}
						</div>
					) : (
						<p>WebUSB is NOT supported</p>
					)}
				</header>
			</div>
		);
	}
}
