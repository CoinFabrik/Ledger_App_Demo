import React from 'react';
import './App.css';
import LedgerUSB from './LedgerUSB';

export default class App extends React.Component {
	constructor (props) {
		super(props);

		this.allowUsbAccess = this.allowUsbAccess.bind(this);
		this.getAddress = this.getAddress.bind(this);
		this.ledgerUSB = new LedgerUSB();
		
		this.state = {
			getAddress: {
				address: '',
				error: ''
			}
		}
	}

	async allowUsbAccess(e) {
		this.ledgerUSB.allowAccess();
	}

	async getAddress(e) {
		try {
			let address = await this.ledgerUSB.getAddress();
			this.setState({
				getAddress: {
					address,
					error: ''
				}
			});
		}
		catch (err) {
			this.setState({
				getAddress: {
					address: '',
					error: err.stack ? err.stack.toString() : err.toString()
				}
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
							<p><button onClick={this.getAddress}>Get Address</button></p>
							<hr />
							{
								(
									this.state.getAddress.address.length > 0 &&
									<p>Address is: {this.state.getAddress.address}</p>
								)
							}
							{
								(
									this.state.getAddress.error.length > 0 &&
									<p>Error: <pre style={preBlockCSS}> {this.state.getAddress.error}</pre></p>
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
