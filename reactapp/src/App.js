import React from 'react';
import CanvasJSReact from './canvasjs.react';
import GoogleSuggest from './PlaceAutocomplete'
import Mappy from './Mappy/Mappy.js';
import axios from 'axios';
import Moment from 'moment';

import './app.css';

var CanvasJSChart = CanvasJSReact.CanvasJSChart;

class App extends React.Component {
  constructor(props) {
    super(props);

    this.earliestTime = React.createRef();
    this.latestTime = React.createRef();
    this.state = {
      startLocation: undefined,
      endLocation: undefined,
      data: undefined,
      timezoneOffset: new Date().getTimezoneOffset() / 60,
      tolerance: undefined,
      errorMessage: '',
      optimalTime: undefined,
      optimalTravelLength: undefined,
      waypoint0: null,
      waypoint1: null,
      route: null,
      rawData: null,
      extraInputsStyle: {visibility: ''},
      formtwoStyle: {visibility: 'hidden'},
      formattedEarliest: undefined,
      formattedLatest: undefined,
    }
  }

  componentDidMount() {
  }

  setStartLocation = (startLocation) => {
    this.setState(() => {
      return {
        startLocation
      }
    })
  }

  setEndLocation = (endLocation) => {
    this.setState(() => {
      return {
        endLocation
      }
    })
  }

  setDesiredTime = (desiredTime) => {
    this.setState(() => {
      return { desiredTime }
    })
  }

  timeToDateObj = (hoursandMinutes) => {
    const timeSplit = hoursandMinutes.split(':');
    const hours = parseInt(timeSplit[0]) % 24;
    const minutes = parseInt(timeSplit[1]);

    const currentTime = new Date();
    return new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), hours, minutes, 0, 0);
  }

  calculateOptimalTime = (e) => {
    e.preventDefault();

    const earliestDate = this.timeToDateObj(this.earliestTime.current.value);
    const latestDate = this.timeToDateObj(this.latestTime.current.value);
  
    const earliestMoment = Moment(earliestDate).add(4, 'days');
    let latestMoment = Moment(latestDate).add(4, 'days');

    // Account for things that go past midnight

    if (latestMoment.isBefore(earliestMoment)) {
      latestMoment.add(1, 'day');
    }

    const validRoutes = this.state.rawData.filter((datum) => {
      const tempMoment = Moment(new Date(datum.label));
      return tempMoment.isBetween(earliestMoment, latestMoment, 'minute', '[]');
    });

    let bestEntry = validRoutes[0];
    validRoutes.forEach((elt) => {
      if (elt.y < bestEntry.y){
        bestEntry = elt;
      }
    });

    const optimalTime = Moment(new Date(bestEntry.label)).format('LT');

    this.setState(() => {
      return {
        optimalTime,
        optimalTravelLength: bestEntry.y,
        formattedEarliest: earliestMoment,
        formattedLatest: latestMoment,
      }
    });
  }

  submitData = (e) => {
    this.setState({
      formtwoStyle: {visibility: ''}
    })
    e.preventDefault();
    if(this.state.startLocation && this.state.endLocation) {
      console.log("axios GET request submtting to ec2");
      axios.get('http://ec2-18-217-197-235.us-east-2.compute.amazonaws.com:8000/histogram', {
        params: {
          startLocation: this.state.startLocation.formatted_address,
          endLocation: this.state.endLocation.formatted_address,
          timeOffset: this.state.timezoneOffset,
        }
      })
      .then(response => {
        const rawDataArray = response.data.query_data;
        let data = [];

        rawDataArray.forEach((datum) => {
          var timeString = Moment(datum.label).format('LT');
          var value = datum.y;

          data.push({label: timeString, y: value});
        });

        this.setState(() => {
          return {
            error: '',
            data,
            rawData: rawDataArray,
          };
        });

        this.setState({waypoint0: response.data.waypoint0, waypoint1: response.data.waypoint1, route: response.data.query_data[0]["route"][0]});
      })
      .catch(error => {
        console.log(error);
      });
    }
    else {
      this.setState(() => { 
        return {error: 'Please fill out the start end end location!' }
      });
    }

  }

  render() {
    const options = {
      title: {
        text: 'Commute Time',
        fontFamily: 'sans-serif',
      },
      axisX: {
        title: 'Time of Day'
      },
      axisY: {
        title: 'Commute Time (minutes)'
      },
      colorSet: 'blue',
      data: [
        {
          // Change type to "doughnut", "line", "splineArea", etc.
          type: "line",
          dataPoints: this.state.data
        }
      ],
      dataPointWidth: 30,
      width: window.innerWidth * 0.9,
      height: window.innerHeight * 0.4,
    }

    return (
      <div>
        <div className="inputSection">
        {this.state.error && <p>{this.state.error}</p>}
        <div className="title"> Commute Curve </div>
        <form className="form">
          Start Location <GoogleSuggest
            passUpLocation={this.setStartLocation}
            initialValue={"345 Spear St, San Francisco, CA 94105, USA"}
          />
          <br/>
          End Location <GoogleSuggest
            passUpLocation={this.setEndLocation}
            initialValue={"415 Mission St, San Francisco, CA 94105, USA"}
          />
          <button onClick={this.submitData} style={{display: 'block'}}>Submit</button>
        </form>
        <form className="formtwo" style={this.state.formtwoStyle}>
          <div>
            Earliest Desired Departure Time: <input type="time" ref={this.earliestTime}></input>
          </div>
          <div>
            Latest Desired Departure Time: <input type="time" min="0" ref={this.latestTime}></input>
          </div>
          <button onClick={this.calculateOptimalTime}>Submit</button>
        </form>
        { this.state.optimalTime && <div className="recommendations">
          <p>{`If you want to leave between ${this.state.formattedEarliest.format('LT')} and ${this.state.formattedLatest.format('LT')}, you should head out at ${this.state.optimalTime} for a travel length of ${Math.round(this.state.optimalTravelLength)} minutes.`}</p>
        </div>}
        </div>

        {/* MAP */}
        <Mappy route={this.state.route}/>

        <br/>

        {/* CHART */}
        {
          this.state.data && 
          <div className="chartOuterContainer">
            <div className="chartInnerContainer">
              <CanvasJSChart options={options}
              onRef={ref => this.chart = ref}
              />
            </div>
          </div>
        }
        
      </div>
    )
  }
}

export default App;
