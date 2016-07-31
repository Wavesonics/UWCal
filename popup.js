Number.prototype.pad = function(size)
{
	var s = String(this);
	while (s.length < (size || 2)) {s = "0" + s;}
	return s;
}

function isString(x)
{
	return x !== null && x !== undefined && x.constructor === String
}

function trimIfString(x)
{
	if( isString( x ) )
	{
		return x.trim();
	}
	else
	{
		return x;
	}
}

class CalendarEvent
{
	constructor(date, workingHours, type)
	{
		this.date = date;
		this.workingHours = workingHours;
		this.type = type;
	}
	
	dateIsValid()
	{
		return this.date != "";
	}
	
	isWorkDay()
	{
		
		return this.workingHours != "" && this.type && this.type.startsWith("REG") && this.dateIsValid();
	}
	
	isVacationDay()
	{
		return (this.type.startsWith("REG") && this.type.startsWith("HOL")) && this.dateIsValid();
	}
	
	getStartHour()
	{
		var time = "";
		
		var parts = this.workingHours.split('-');
		if( parts.length == 2 )
		{
			time = parts[0].trim();
		}
		
		return time;
	}
	
	getEndHour()
	{
		var time = "";
		
		var parts = this.workingHours.split('-');
		if( parts.length == 2 )
		{
			// Remove the H at the end
			time = parts[1].trim().substring(0, parts[1].length-1);
		}
		
		return time;
	}
}

chrome.runtime.onMessage.addListener(function(request, sender)
{
	if (request.action == "getSource")
	{
		pageSource = request.source;
		pageDocument = $.parseHTML( pageSource );

		var calEvents = [];
		
		var visibleDays = $(pageDocument).find("td.calvisibleday1");
		visibleDays.each( function( index, element )
		{
			var jqElem = $(element);
			
			var date = new Date( jqElem.attr("title") );
			var hours = trimIfString( jqElem.find("div.ftmdltblue").text() );
			var type = trimIfString( jqElem.find("div.ftblack").text() );
			
			var calEvent = new CalendarEvent( date, hours, type );
			if( calEvent.isWorkDay() )
			{
				calEvents.push( calEvent );
			}
		});
		
		var cal = ics();
		for (var i = 0, length = calEvents.length; i < length; i++)
		{
			var calEvent = calEvents[i];
			if( calEvent.date >= startDate && calEvent.date <= endDate )
			{
				var startHour = parseInt(calEvent.getStartHour());
				var endHour = parseInt(calEvent.getEndHour());
				
				var subject = "Work";
				var description = calEvent.type;
				// University of Washington Medical Center
				var location = "1959 NE Pacific St, Seattle, WA 98195";
				var begin = calEvent.date.toLocaleDateString() + " " + startHour.pad(2) + ":00";
				
				// We end on the next day
				if( startHour > endHour )
				{
					var tomorrow = new Date(calEvent.date);
					var days = 1;
					// Add 1 day
					tomorrow.setTime( tomorrow.getTime() + days * 86400000 );
					// Do some crazy date rounding to deal with changing daylight savings and such (thanks stack overflow)
					tomorrow.setTime( tomorrow.getTime() + 12 * 1000 * 60 * 60 );
					tomorrow.setHours(0);	
					var end = tomorrow.toLocaleDateString() + " " + endHour.pad(2) + ":30";
				}
				// Default case where we are ending in the same day
				else
				{
					var end = calEvent.date.toLocaleDateString() + " " + endHour.pad(2) + ":30";
				}
				console.log("start: " + begin);
				console.log("end: " + end);
				cal.addEvent(subject, description, location, begin, end);
			}
		}
		
		$("#success").show();
		
		var calendar = cal.build();
		
		let docContent = calendar;
		let doc = URL.createObjectURL( new Blob([docContent], {type: 'application/octet-binary'}) );
		chrome.downloads.download({ url: doc, filename: "schedule.ics", conflictAction: 'overwrite', saveAs: true });
	}
});

var startDate = null;
var endDate = null;

// This fixes Date parsing being off by 1 day, thanks JavaScript
// http://stackoverflow.com/questions/7556591/javascript-date-object-always-one-day-off
function parseDate( dateStr )
{
	return new Date( dateStr.replace(/-/g, '\/').replace(/T.+/, '') );
}

function injectCalendarScript()
{	
	var startDateStr = $("#startDate").val();
	var endDateStr = $("#endDate").val();
	
	if( Date.parse( startDateStr ) && Date.parse( endDateStr ) )
	{
		$("#config").hide();
		
		startDate = parseDate( startDateStr );
		endDate = parseDate( endDateStr );

		console.log( startDate );
		console.log( endDate );
		
		var message = document.querySelector('#message');

		chrome.tabs.executeScript(null,
		{
			file: "getPagesSource.js"
		},
		function()
		{
			// If you try and inject into an extensions page or the webstore/NTP you'll get an error
			if (chrome.runtime.lastError)
			{
				message.innerText = 'There was an error injecting script : \n' + chrome.runtime.lastError.message;
			}
		});
	}
	else
	{
		alert( "Please enter Start and End dates" );
	}
}

$(document).ready(function() {
	$('#execute').click(injectCalendarScript);
});