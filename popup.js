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

var modifierRegEx = /\+([A-Z]{3})/;
var hoursRegEx = /(c?(\d?\d)-c?(\d?\d)h)/;
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
		
		return this.workingHours != "";// && this.type && this.type.startsWith("REG") && this.dateIsValid();
	}
	
	isVacationDay()
	{
		return (this.type.startsWith("VAC") || this.type.startsWith("HOL")) && this.dateIsValid();
	}
	
	isWorkingHoursValid()
	{
		return hoursRegEx.test(this.workingHours);
	}
	
	getStartHour()
	{
		var time = "";
		var match = hoursRegEx.exec(this.workingHours);
		
		return match[2];
	}
	
	getEndHour()
	{
		var time = "";
		var match = hoursRegEx.exec(this.workingHours);

		return match[3];
	}

	getModifier()
	{
		var modifier = "";
		if( modifierRegEx.test(this.workingHours) )
		{
			var match = modifierRegEx.exec(this.workingHours);

			modifier = match[1];
		}
		
		return modifier;
	}
}

chrome.runtime.onMessage.addListener(function(request, sender)
{
	if (request.action == "getSource")
	{
		pageSource = request.source;
		pageDocument = $.parseHTML( pageSource );

		var calEvents = [];
		
		var visibleDays = $(pageDocument).find("td.calvisibleday1,td.calweekend1");
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
				if( calEvent.isWorkingHoursValid() )
				{
					var startHour = parseInt(calEvent.getStartHour());
					var endHour = parseInt(calEvent.getEndHour());	
				}
				else
				{
					var startHour = 0;
					var endHour = 23;	
				}
				
				var subject = "Work";
				var description = calEvent.type + " + " + calEvent.getModifier();
				// University of Washington Medical Center
				var location = "1959 NE Pacific St, Seattle, WA 98195";
				
				var begin = undefined;
				var end = undefined;
				
				begin = calEvent.date.toLocaleDateString() + " " + startHour.pad(2) + ":00";
				
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
					end = tomorrow.toLocaleDateString() + " " + endHour.pad(2) + ":30";
				}
				// Default case where we are ending in the same day
				else
				{
					end = calEvent.date.toLocaleDateString() + " " + endHour.pad(2) + ":30";
				}
				
				console.log("start: " + begin);
				console.log("end: " + end);
				cal.addEvent(subject, description, location, begin, end);
			}
		}
		
		var calendar = cal.calendar();
		var numEvents = cal.events().length;
		
		if( calendar && numEvents > 0 )
		{
			$("#message").text( "Extracted " + cal.events().length + " events" );
			$("#success").show();
			
			let docContent = calendar;
			let doc = URL.createObjectURL( new Blob([docContent], {type: 'application/octet-binary'}) );
			chrome.downloads.download({ url: doc, filename: "schedule.ics", conflictAction: 'overwrite', saveAs: true });
		}
		else
		{
			$("#failure").show();
		}
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