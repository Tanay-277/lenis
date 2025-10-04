import React, { useState, useEffect, useRef } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface AutocompleteInputProps {
	id: string;
	name: string;
	label: string;
	options: string[];
	value: string;
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	placeholder?: string;
	disabled?: boolean;
	required?: boolean;
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
	id,
	name,
	label,
	options,
	value,
	onChange,
	placeholder,
	disabled,
	required,
}) => {
	const [showOptions, setShowOptions] = useState(false);
	const [filteredOptions, setFilteredOptions] = useState<string[]>(options);
	const wrapperRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!value) {
			setFilteredOptions(options);
		} else {
			const filtered = options.filter((opt) =>
				opt.toLowerCase().includes(value.toLowerCase())
			);
			setFilteredOptions(filtered);
		}
	}, [value, options]);

	// Close dropdown on outside click
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (
				wrapperRef.current &&
				!wrapperRef.current.contains(event.target as Node)
			) {
				setShowOptions(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// On selecting an option
	const handleOptionClick = (option: string) => {
		// Create a synthetic event for onChange with the selected value
		const syntheticEvent = {
			target: { name, value: option },
		} as React.ChangeEvent<HTMLInputElement>;
		onChange(syntheticEvent);
		setShowOptions(false);
	};

	return (
		<div className="relative w-full" ref={wrapperRef}>
			<Label htmlFor={id} className="mb-3">
				{label}
				{required && " *"}
			</Label>
			<Input
				id={id}
				name={name}
				autoComplete="off"
				value={value}
				onChange={(e) => {
					onChange(e);
					setShowOptions(true);
				}}
				onFocus={() => setShowOptions(true)}
				placeholder={placeholder}
				disabled={disabled}
				required={required}
			/>
			{showOptions && filteredOptions.length > 0 && (
				<ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200/10 bg-white shadow-md dark:bg-card">
					{filteredOptions.map((option) => (
						<li
							key={option}
							className="cursor-pointer px-3 py-2 hover:bg-foreground/10 m-2 mt-1 mb-0 rounded-md text-sm"
							onClick={() => handleOptionClick(option)}
							tabIndex={0}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									handleOptionClick(option);
								}
							}}
							role="option"
							aria-selected={option === value}
						>
							{option}
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

export default AutocompleteInput;
